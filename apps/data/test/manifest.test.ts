import { describe, expect, it } from "vitest";
import { buildDirectoryEntry, buildManifest, INDEX_VERSION } from "../src/manifest.ts";

const AT = "2026-09-30T00:00:00.000Z";

describe("buildDirectoryEntry", () => {
  it("groups variations by fixture per kind", () => {
    const entry = buildDirectoryEntry({
      name: "2026-09-30",
      files: [
        "astro-clean.json",
        "astro-clean-package-count.json",
        "astro-clean-process-count.json",
        "astro-cache+lockfile.json",
        "next-clean.json",
        "chart-data.json",
        "versions.json",
      ],
    });
    expect(entry.benchmarks).toEqual({
      astro: ["cache+lockfile", "clean"],
      next: ["clean"],
    });
    expect(entry.packageCounts).toEqual({ astro: ["clean"] });
    expect(entry.processCounts).toEqual({ astro: ["clean"] });
    expect(entry.hasChartData).toBe(true);
    expect(entry.hasVersions).toBe(true);
    expect(entry.isLatest).toBe(false);
    expect(entry.fileCount).toBe(7);
  });

  it("records a registry variation as having no process-count", () => {
    // The published tree has 0 registry-* process-count files. The manifest
    // must reflect that rather than implying the triple always exists.
    const entry = buildDirectoryEntry({
      name: "2026-09-30",
      files: ["astro-registry-clean.json", "astro-registry-clean-package-count.json"],
    });
    expect(entry.benchmarks).toEqual({ astro: ["registry-clean"] });
    expect(entry.packageCounts).toEqual({ astro: ["registry-clean"] });
    expect(entry.processCounts).toEqual({});
  });

  it("marks latest/ and reports its missing versions.json", () => {
    const entry = buildDirectoryEntry({
      name: "latest",
      files: ["next-clean.json", "chart-data.json"],
    });
    expect(entry.isLatest).toBe(true);
    expect(entry.hasVersions).toBe(false);
    expect(entry.hasChartData).toBe(true);
  });

  it("counts unclassifiable files but does not index them", () => {
    const entry = buildDirectoryEntry({
      name: "2026-09-30",
      files: ["next-clean.json", "npm-output-0.log", "README.md"],
    });
    expect(entry.fileCount).toBe(3);
    expect(entry.benchmarks).toEqual({ next: ["clean"] });
  });
});

describe("buildManifest", () => {
  it("ignores everything at the publish root that is not a date or latest", () => {
    const { index, manifest } = buildManifest(
      [
        { name: "2025-08-22", files: ["next-clean.json"] },
        { name: "2026-09-30", files: ["astro-clean.json", "chart-data.json"] },
        { name: "latest", files: ["astro-clean.json"] },
        // All of these really are at the gh-pages root.
        { name: "assets", files: ["index-abc.js"] },
        { name: "data", files: ["x.json"] },
        { name: "old", files: [] },
        { name: "raw", files: [] },
        { name: "results-astro-clean", files: ["benchmarks.json"] },
        { name: "results-astro-ci+setup", files: ["benchmarks.json"] },
      ],
      AT,
    );
    expect(index.dates).toEqual(["2025-08-22", "2026-09-30"]);
    expect(index.hasLatestDir).toBe(true);
    expect(Object.keys(manifest.entries).sort()).toEqual(["2025-08-22", "2026-09-30", "latest"]);
  });

  it("reports latest as the newest DATE, never the latest/ directory", () => {
    const { index } = buildManifest(
      [
        { name: "2026-01-02", files: [] },
        { name: "latest", files: [] },
        { name: "2025-12-31", files: [] },
      ],
      AT,
    );
    expect(index.latest).toBe("2026-01-02");
    expect(index.dates).toEqual(["2025-12-31", "2026-01-02"]);
  });

  it("collects the observed vocabularies rather than assuming them", () => {
    const { index } = buildManifest(
      [{ name: "2026-09-30", files: ["astro-ci+setup.json", "run-run.json"] }],
      AT,
    );
    expect(index.fixtures).toEqual(["astro", "run"]);
    expect(index.variations).toEqual(["ci+setup", "run"]);
  });

  it("handles an empty tree without inventing a latest", () => {
    const { index, manifest } = buildManifest([], AT);
    expect(index.latest).toBeNull();
    expect(index.dates).toEqual([]);
    expect(index.hasLatestDir).toBe(false);
    expect(manifest.entries).toEqual({});
    expect(index.version).toBe(INDEX_VERSION);
  });
});
