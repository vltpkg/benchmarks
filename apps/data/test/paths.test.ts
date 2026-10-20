import { describe, expect, it } from "vitest";
import { dataUrl, manifestShardPath, parseDataFile } from "../src/paths.ts";

describe("parseDataFile", () => {
  it("splits a plain variation", () => {
    expect(parseDataFile("next-clean.json")).toEqual({
      kind: "benchmark",
      fixture: "next",
      variation: "clean",
    });
  });

  it("keeps hyphens that belong to the variation", () => {
    // The reason splitting on the FIRST hyphen is correct: no fixture name
    // contains one, but several variations do.
    expect(parseDataFile("astro-registry-clean.json")).toEqual({
      kind: "benchmark",
      fixture: "astro",
      variation: "registry-clean",
    });
    expect(parseDataFile("next-build-cache.json")).toEqual({
      kind: "benchmark",
      fixture: "next",
      variation: "build-cache",
    });
  });

  it("handles variations containing +", () => {
    expect(parseDataFile("astro-cache+lockfile+node_modules.json")).toEqual({
      kind: "benchmark",
      fixture: "astro",
      variation: "cache+lockfile+node_modules",
    });
  });

  it("distinguishes the three kinds, including on a registry variation", () => {
    expect(parseDataFile("astro-registry-clean-package-count.json")).toEqual({
      kind: "package-count",
      fixture: "astro",
      variation: "registry-clean",
    });
    expect(parseDataFile("vue-cache+lockfile-process-count.json")).toEqual({
      kind: "process-count",
      fixture: "vue",
      variation: "cache+lockfile",
    });
  });

  it("accepts a variation newer than this checkout's suite", () => {
    // `ci+setup` was added upstream on 2026-09-30 and published the same day,
    // ahead of this workspace's base at the time. Rejecting such a variation
    // would under-report the tree.
    expect(parseDataFile("astro-ci+setup.json")).toEqual({
      kind: "benchmark",
      fixture: "astro",
      variation: "ci+setup",
    });
  });

  it("rejects everything that is not a per-fixture data file", () => {
    for (const name of [
      "chart-data.json",
      "versions.json",
      "index.json",
      "manifest.json",
      ".nojekyll",
      "CNAME",
      "index.html",
      "astro.json",
      "-clean.json",
      "unknownfixture-clean.json",
      "astro-.json",
      "astro-clean.txt",
    ]) {
      expect(parseDataFile(name), name).toBeUndefined();
    }
  });
});

describe("dataUrl", () => {
  it("joins segments onto a base with or without a trailing slash", () => {
    expect(dataUrl("https://x.test", "2026-09-30", "next-clean.json")).toBe(
      "https://x.test/2026-09-30/next-clean.json",
    );
    expect(dataUrl("https://x.test/", "index.json")).toBe("https://x.test/index.json");
  });

  it("encodes + in a variation so the URL is unambiguous", () => {
    expect(dataUrl("https://x.test", "2026-09-30", "astro-cache+lockfile.json")).toBe(
      "https://x.test/2026-09-30/astro-cache%2Blockfile.json",
    );
  });
});

describe("manifestShardPath", () => {
  it("puts shards in a sibling directory, not inside the date directory", () => {
    // Decision D2 forbids re-emitting the published date directories, so the
    // shard must not land inside one.
    expect(manifestShardPath("2026-09-30")).toEqual(["manifest", "2026-09-30.json"]);
    expect(manifestShardPath("2026-09-30")[0]).not.toBe("2026-09-30");
  });

  it("shards latest/ alongside the dates", () => {
    expect(manifestShardPath("latest")).toEqual(["manifest", "latest.json"]);
  });

  it("builds a fetchable url", () => {
    expect(dataUrl("https://x.test", ...manifestShardPath("2026-09-30"))).toBe(
      "https://x.test/manifest/2026-09-30.json",
    );
  });
});
