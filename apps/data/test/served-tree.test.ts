/**
 * End-to-end over REAL published data: materialize a subset of gh-pages, build
 * the manifest, serve it, and fetch through the client.
 *
 * Reads the branch through `git show` -- no network. Skips when the ref is
 * absent so a shallow clone does not fail; the unit tests always run.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataClient, DataFetchError } from "../src/client.ts";
import type { DataIndex, DataManifest } from "../src/manifest.ts";
import { createDataServer } from "../src/serve.ts";

const REF = "origin/gh-pages";

/**
 * Every git call runs from the repository root. `git ls-tree` resolves paths
 * against the current prefix, and vitest runs from the package directory -- a
 * trap that silently returned an empty listing at exit 0 in packages/types.
 */
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const git = (...args: string[]): string =>
  execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

const refExists = (): boolean => {
  try {
    git("rev-parse", "--verify", `${REF}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

// One current date, the oldest date, and latest/ -- the three directories with
// materially different contents.
const DIRS = ["2026-09-30", "2025-08-22", "latest"];

let root = "";
let baseUrl = "";
let server: ReturnType<typeof createDataServer> | undefined;
let index: DataIndex;
let manifest: DataManifest;

const skip = !refExists();

describe.skipIf(skip)("served tree, built from real gh-pages data", () => {
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "bench-data-"));
    for (const dir of DIRS) {
      mkdirSync(join(root, dir), { recursive: true });
      for (const name of git("ls-tree", "--name-only", `${REF}:${dir}`)
        .split("\n")
        .filter(Boolean)) {
        writeFileSync(join(root, dir, name), git("show", `${REF}:${dir}/${name}`));
      }
    }
    // Also reproduce the junk the publish root really carries, to prove the
    // scanner ignores it.
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(join(root, "assets", "index-abc.js"), "// ui asset\n");
    mkdirSync(join(root, "results-astro-clean"), { recursive: true });
    writeFileSync(join(root, "results-astro-clean", "benchmarks.json"), "{}\n");
    writeFileSync(join(root, "index.html"), "<!doctype html><title>live site</title>\n");
    writeFileSync(join(root, "CNAME"), "benchmarks.vlt.sh\n");

    // Run the REAL CLI rather than reimplementing what it does. An earlier
    // version of this fixture built the index and shards inline, which meant a
    // change to the CLI could not fail any test -- found by injecting a
    // timestamp into the CLI's shards and watching the suite still pass.
    execFileSync(
      process.execPath,
      [join(import.meta.dirname, "..", "bin", "build-manifest.mts"), "--out", root, root],
      { encoding: "utf8" },
    );
    index = JSON.parse(readFileSync(join(root, "index.json"), "utf8")) as DataIndex;
    manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as DataManifest;

    server = createDataServer({ root, port: 0 });
    await new Promise<void>((done) => server?.listen(0, "127.0.0.1", done));
    const address = server?.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const client = (): DataClient => new DataClient({ baseUrl });

  it("indexes the real dates and ignores the publish-root junk", async () => {
    const served = await client().getIndex();
    expect(served.dates).toEqual(["2025-08-22", "2026-09-30"]);
    expect(served.latest).toBe("2026-09-30");
    expect(served.hasLatestDir).toBe(true);
    expect(Object.keys(served).sort()).toEqual([
      "dates",
      "fixtures",
      "generatedAt",
      "hasLatestDir",
      "latest",
      "variations",
      "version",
    ]);
    const entries = (await client().getManifest()).entries;
    expect(Object.keys(entries).sort()).toEqual(["2025-08-22", "2026-09-30", "latest"]);
  });

  it("serves a shard equal to the manifest entry, for every published directory", async () => {
    // The invariant that makes the two interchangeable: a consumer switching
    // from getManifest() to getDirectoryEntry() changes cost and nothing else.
    const served = await client().getManifest();
    for (const name of Object.keys(served.entries)) {
      const shard = await client().getDirectoryEntry(name);
      expect(shard, name).toEqual(served.entries[name]);
    }
    // Includes the oldest date, the newest, one with a '+' variation, and latest/.
    expect(Object.keys(served.entries).sort()).toEqual(["2025-08-22", "2026-09-30", "latest"]);
    const newest = await client().getDirectoryEntry("2026-09-30");
    expect(newest.benchmarks.astro).toContain("cache+lockfile+node_modules");
    const oldest = await client().getDirectoryEntry("2025-08-22");
    expect(oldest.hasChartData).toBe(true);
    const latest = await client().getDirectoryEntry("latest");
    expect(latest.isLatest).toBe(true);
    expect(latest.hasVersions).toBe(false);
  });

  it("carries no timestamp in a shard, so unchanged dates stay byte-identical", () => {
    // If a shard embedded generatedAt, all 353 would change every nightly run
    // and the gh-pages branch would grow by 353 blobs a day.
    for (const entry of Object.values(manifest.entries)) {
      const keys = Object.keys(entry ?? {});
      expect(keys).not.toContain("generatedAt");
      expect(keys.some((k) => /at$|time/i.test(k))).toBe(false);
    }
  });

  it("a shard costs roughly one entry, not the whole archive", async () => {
    // Scale-independent: a shard must be about the size of its own entry, so
    // the saving grows with the number of published directories. This fixture
    // has three, so no fixed ratio is assertable here -- the real-tree figure
    // (842,509 bytes against a 5,205-byte shard, 161.9:1) is in the evidence.
    const shardText = JSON.stringify(await client().getDirectoryEntry("2026-09-30"));
    const fullText = JSON.stringify(await client().getManifest());
    const entryCount = Object.keys(manifest.entries).length;
    expect(shardText.length).toBeLessThan(fullText.length);
    // Within a small constant of the manifest's per-entry share.
    expect(shardText.length).toBeLessThan((fullText.length / entryCount) * 3);
  });

  it("does not publish an index.html of its own", () => {
    // The gh-pages root index.html IS the live site. This app writes only the
    // two JSON files; the one in the fixture is the pre-existing site file.
    const written = readFileSync(join(root, "index.html"), "utf8");
    expect(written).toContain("live site");
    expect(index).not.toHaveProperty("html");
  });

  it("serves a + variation through the client, end to end", async () => {
    const file = await client().getBenchmark("2026-09-30", "astro", "cache+lockfile+node_modules");
    expect(file.results.length).toBeGreaterThan(0);
    const first = file.results[0];
    expect(typeof first?.command).toBe("string");
    expect(typeof first?.median).toBe("number");
    expect(first?.exit_codes).toHaveLength(first?.times.length ?? -1);
  });

  it("serves a registry-* benchmark and its REGISTRY-keyed package-count", async () => {
    const file = await client().getBenchmark("2026-09-30", "astro", "registry-clean");
    expect(file.results.length).toBeGreaterThan(0);
    const counts = await client().getPackageCount("2026-09-30", "astro", "registry-clean");
    expect(Object.keys(counts).sort()).toEqual([
      "aws",
      "cloudsmith",
      "github",
      "jfrog",
      "npm",
      "vlt",
    ]);
  });

  it("reports registry-* variations as having no process-count, and 404s for one", async () => {
    const entry = manifest.entries["2026-09-30"];
    expect(entry?.benchmarks.astro).toContain("registry-clean");
    expect(entry?.processCounts.astro ?? []).not.toContain("registry-clean");
    await expect(
      client().getProcessCount("2026-09-30", "astro", "registry-clean"),
    ).rejects.toBeInstanceOf(DataFetchError);
  });

  it("distinguishes package-counts with minCount/maxCount from those without", async () => {
    const withRange = await client().getPackageCount("2026-09-30", "astro", "cache+lockfile");
    const withoutRange = await client().getPackageCount("2026-09-30", "astro", "clean");
    expect(Object.values(withRange).some((e) => e?.minCount !== undefined)).toBe(true);
    expect(Object.values(withoutRange).every((e) => e?.minCount === undefined)).toBe(true);
  });

  it("records that latest/ has no versions.json, and 404s for it", async () => {
    expect(manifest.entries["latest"]?.hasVersions).toBe(false);
    expect(manifest.entries["2026-09-30"]?.hasVersions).toBe(true);
    await expect(client().getVersions("latest")).rejects.toMatchObject({ status: 404 });
    const versions = await client().getVersions("2026-09-30");
    expect(Object.keys(versions).length).toBeGreaterThan(0);
  });

  it("serves the newest chart-data with all seven keys", async () => {
    const chart = await client().getChartData("2026-09-30");
    expect(Object.keys(chart).sort()).toEqual([
      "chartData",
      "commitSha",
      "date",
      "perPackageCountChartData",
      "registryChartData",
      "registryPerPackageCountChartData",
      "versions",
    ]);
  });

  it("serves the OLDEST chart-data, which has only its two required keys", async () => {
    const chart = await client().getChartData("2025-08-22");
    expect(Object.keys(chart).sort()).toEqual(["chartData", "perPackageCountChartData"]);
    expect(chart.date).toBeUndefined();
    expect(chart.versions).toBeUndefined();
    expect(chart.registryChartData).toBeUndefined();
  });

  it("serves JSON with a json content-type and 404s outside the tree", async () => {
    const response = await fetch(`${baseUrl}/index.json`);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await fetch(`${baseUrl}/nope.json`)).status).toBe(404);
    // No directory listing, and no traversal.
    expect((await fetch(`${baseUrl}/2026-09-30/`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/../../etc/passwd`)).status).toBeGreaterThanOrEqual(400);
  });
});
