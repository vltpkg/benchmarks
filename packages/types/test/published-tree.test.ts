/**
 * Parses the real data on the `gh-pages` branch and checks it against the
 * types in this package. No network: the branch is read through `git show`.
 *
 * If the `gh-pages` ref is not present locally these tests skip rather than
 * fail, so a shallow clone does not break the suite. `guards.test.ts` always
 * runs, so a skip here never leaves the package untested.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  type BenchmarkFile,
  type ChartData,
  isDateKey,
  isFixture,
  isVariation,
  type PackageCount,
  type ProcessCount,
  type Versions,
} from "../src/index.ts";

const REF = "origin/gh-pages";
const DATE = "2026-09-30";

/**
 * Run git from the repository root. `git ls-tree` resolves paths relative to
 * the current prefix, so running it from this package would list
 * `gh-pages:packages/types` -- which does not exist -- and quietly return
 * nothing.
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

const read = <T>(path: string): T => JSON.parse(git("show", `${REF}:${path}`)) as T;
const list = (path: string): string[] =>
  git("ls-tree", "--name-only", `${REF}:${path}`).split("\n").filter(Boolean);

describe.skipIf(!refExists())(`published tree (${REF})`, () => {
  it("has the date directories and latest/ the data contract describes", () => {
    const entries = git("ls-tree", "-d", "--name-only", REF).split("\n").filter(Boolean);
    const dates = entries.filter(isDateKey);
    expect(dates.length).toBeGreaterThan(300);
    expect(dates).toContain("2025-08-22");
    expect(dates).toContain(DATE);
    expect(entries).toContain("latest");
  });

  // One plain variation, one with a '+', and one registry-* -- the three
  // shapes most likely to be got wrong.
  const benchmarkFiles = [
    "next-clean.json",
    "astro-cache+lockfile+node_modules.json",
    "astro-registry-clean.json",
  ];

  it.each(benchmarkFiles)("parses %s as a BenchmarkFile", (name) => {
    const file = read<BenchmarkFile>(`${DATE}/${name}`);
    expect(Object.keys(file)).toEqual(["results"]);
    expect(file.results.length).toBeGreaterThan(0);

    for (const r of file.results) {
      expect(typeof r.command).toBe("string");
      for (const field of ["mean", "stddev", "median", "min", "max", "user", "system"] as const) {
        expect(typeof r[field], `${name} ${r.command}.${field}`).toBe("number");
        expect(Number.isFinite(r[field])).toBe(true);
      }
      expect(r.times.every((t) => typeof t === "number")).toBe(true);
      expect(r.exit_codes.every((c) => typeof c === "number")).toBe(true);
      // times and exit_codes are parallel, one entry per hyperfine run
      expect(r.exit_codes).toHaveLength(r.times.length);
      expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });

  it("parses a package-count file keyed by package manager", () => {
    const counts = read<PackageCount>(`${DATE}/astro-clean-package-count.json`);
    const entries = Object.entries(counts);
    expect(entries.length).toBeGreaterThan(0);
    for (const [series, entry] of entries) {
      expect(entry, series).toBeDefined();
      expect(typeof entry?.count).toBe("number");
    }
  });

  it("parses a registry-* package-count file, which is keyed by REGISTRY name", () => {
    const counts = read<PackageCount>(`${DATE}/astro-registry-clean-package-count.json`);
    // Registries, not package managers -- this is the distinction a consumer
    // is most likely to get wrong.
    expect(Object.keys(counts).sort()).toEqual([
      "aws",
      "cloudsmith",
      "github",
      "jfrog",
      "npm",
      "vlt",
    ]);
  });

  it("finds package-count entries where minCount/maxCount are present, and others where they are not", () => {
    const withRange = read<PackageCount>(`${DATE}/astro-cache+lockfile-package-count.json`);
    const withoutRange = read<PackageCount>(`${DATE}/astro-clean-package-count.json`);
    const hasRange = Object.values(withRange).some(
      (e) => e?.minCount !== undefined && e?.maxCount !== undefined,
    );
    const allBare = Object.values(withoutRange).every(
      (e) => e?.minCount === undefined && e?.maxCount === undefined,
    );
    expect(hasRange, "expected a file carrying minCount/maxCount").toBe(true);
    expect(allBare, "expected a file carrying neither").toBe(true);
  });

  it("parses a process-count file, and confirms registry-* variations have none", () => {
    const counts = read<ProcessCount>(`${DATE}/astro-clean-process-count.json`);
    for (const [series, entry] of Object.entries(counts)) {
      expect(entry, series).toBeDefined();
      expect(typeof entry?.count).toBe("number");
    }
    const names = list(DATE);
    const registryBenchmarks = names.filter(
      (n) => n.includes("registry-") && !n.includes("-count.json"),
    );
    const registryProcessCounts = names.filter(
      (n) => n.includes("registry-") && n.endsWith("-process-count.json"),
    );
    expect(registryBenchmarks.length).toBeGreaterThan(0);
    expect(registryProcessCounts).toEqual([]);
  });

  it("parses versions.json, and confirms latest/ carries none", () => {
    const versions = read<Versions>(`${DATE}/versions.json`);
    expect(Object.keys(versions).length).toBeGreaterThan(0);
    for (const [tool, v] of Object.entries(versions)) {
      expect(typeof v, tool).toBe("string");
    }
    expect(list("latest")).not.toContain("versions.json");
  });

  it("parses the current chart-data.json with every optional section present", () => {
    const chart = read<ChartData>(`${DATE}/chart-data.json`);
    expect(chart.chartData).toBeDefined();
    expect(chart.perPackageCountChartData).toBeDefined();
    expect(chart.registryChartData).toBeDefined();
    expect(chart.registryPerPackageCountChartData).toBeDefined();
    expect(isDateKey(chart.date)).toBe(true);
    expect(typeof chart.commitSha).toBe("string");

    for (const section of [chart.chartData, chart.perPackageCountChartData]) {
      expect(Object.keys(section).sort()).toEqual([
        "colors",
        "data",
        "packageManagers",
        "variations",
      ]);
      for (const variation of section.variations) {
        // NOT isVariation() -- the published tree can hold variations this
        // checkout's suite does not (ci+setup did, 2026-09-30 until this
        // workspace caught up). A published variation is an opaque string.
        expect(typeof variation, variation).toBe("string");
        expect(variation.length, variation).toBeGreaterThan(0);
        const rows = section.data[variation];
        expect(rows, variation).toBeDefined();
        for (const row of rows ?? []) {
          expect(isFixture(row.fixture), String(row.fixture)).toBe(true);
        }
      }
    }
  });

  it("recognises ci+setup, which the suite runs again", () => {
    // `ci+setup` was added upstream in 3c9e07ef7a on 2026-09-30 and published
    // the same day, ahead of this workspace's base. The suite runs it again, so
    // the union and the published tree agree on it.
    const chart = read<ChartData>(`${DATE}/chart-data.json`);
    const published = new Set(chart.chartData.variations);
    expect(published.has("ci+setup")).toBe(true);
    expect(isVariation("ci+setup")).toBe(true);
    // The ones the suite does run are still recognised.
    expect(isVariation("clean")).toBe(true);
    expect([...published].filter((v) => isVariation(v)).length).toBeGreaterThan(5);
  });

  it("parses the OLDEST chart-data.json, which has only the two required sections", () => {
    const chart = read<ChartData>("2025-08-22/chart-data.json");
    // This is why the rest of ChartData is optional. A consumer that requires
    // `date`, `versions` or either registry section throws on this directory.
    expect(Object.keys(chart).sort()).toEqual(["chartData", "perPackageCountChartData"]);
    expect(chart.chartData.packageManagers.length).toBeGreaterThan(0);
    expect(chart.date).toBeUndefined();
    expect(chart.versions).toBeUndefined();
    expect(chart.registryChartData).toBeUndefined();
    expect(chart.registryPerPackageCountChartData).toBeUndefined();
  });

  it("accepts every chart-data.json in the archive", () => {
    const dates = git("ls-tree", "-d", "--name-only", REF)
      .split("\n")
      .filter((d) => isDateKey(d));
    // Sampled rather than all 352, to keep the suite quick. Strided so it
    // spans every historical shape.
    const sample = dates.filter((_, i) => i % 17 === 0);
    expect(sample.length).toBeGreaterThan(15);
    for (const date of sample) {
      const chart = read<ChartData>(`${date}/chart-data.json`);
      expect(chart.chartData, date).toBeDefined();
      expect(chart.perPackageCountChartData, date).toBeDefined();
      expect(Array.isArray(chart.chartData.packageManagers), date).toBe(true);
      if (chart.date !== undefined) expect(isDateKey(chart.date), date).toBe(true);
    }
  });
});
