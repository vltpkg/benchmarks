import { describe, expect, it } from "vitest";
import { buildSummary, summaryPackageCounts, summaryVersions } from "../src/summary.ts";

describe("buildSummary", () => {
  it("lifts each benchmark file's results verbatim, exit codes and all", () => {
    const files: { [name: string]: string } = {
      "next-clean.json": JSON.stringify({
        results: [
          { command: "npm", mean: 2, stddev: 0.1, median: 2, times: [2], exit_codes: [0] },
          { command: "zpm", mean: 0, stddev: 0, median: 0, times: [0], exit_codes: [1] },
        ],
      }),
      "next-registry-clean.json": JSON.stringify({ results: [] }),
      "next-clean-package-count.json": "{}",
      "chart-data.json": "{}",
      "astro-clean.json": "not json",
      "vue-clean.json": JSON.stringify({ results: [null] }),
      "next-__proto__.json": JSON.stringify({ results: [] }),
    };
    const { summary, skipped } = buildSummary(
      { name: "2026-10-19", files: Object.keys(files) },
      (file) => files[file] ?? "",
    );
    expect(summary).toEqual({
      clean: {
        next: [
          { command: "npm", mean: 2, stddev: 0.1, exit_codes: [0] },
          { command: "zpm", mean: 0, stddev: 0, exit_codes: [1] },
        ],
      },
      "registry-clean": { next: [] },
      ["__proto__"]: { next: [] },
      "#packageCounts": { clean: { next: {} } },
    });
    expect(Object.prototype).not.toHaveProperty("next");
    expect(skipped).toEqual(["astro-clean.json", "vue-clean.json"]);
  });

  it("carries the date's counts and versions verbatim, beside the variations", () => {
    const counts = { npm: { count: 110, minCount: 108, maxCount: 112 }, bun: { count: 100 } };
    const processes = { npm: { count: 4 } };
    const versions = { npm: "11.0.0", vlt: "1.1.0" };
    const files: { [name: string]: string } = {
      "next-clean.json": JSON.stringify({
        results: [{ command: "npm", mean: 2, stddev: 0, exit_codes: [0] }],
      }),
      "next-clean-package-count.json": JSON.stringify(counts),
      "next-clean-process-count.json": JSON.stringify(processes),
      "next-registry-clean-package-count.json": JSON.stringify({ npm: { count: 90 } }),
      "astro-clean-package-count.json": "not json",
      "versions.json": JSON.stringify(versions),
    };
    const { summary, skipped } = buildSummary(
      { name: "2026-10-19", files: Object.keys(files) },
      (file) => files[file] ?? "",
    );
    expect(summaryPackageCounts(summary)).toEqual({
      clean: { next: counts },
      "registry-clean": { next: { npm: { count: 90 } } },
    });
    // Nothing reads process counts from a summary, so it does not carry them.
    expect(
      Object.keys(summary)
        .filter((k) => k.startsWith("#"))
        .sort(),
    ).toEqual(["#packageCounts", "#versions"]);
    expect(summaryVersions(summary)).toEqual(versions);
    // A reader that looks up variations sees exactly what it did before.
    expect(summary["clean"]).toEqual({
      next: [{ command: "npm", mean: 2, stddev: 0, exit_codes: [0] }],
    });
    expect(skipped).toEqual(["astro-clean-package-count.json"]);
  });

  it("leaves out what the date did not publish, rather than writing it empty", () => {
    const { summary } = buildSummary({ name: "2026-10-19", files: ["next-run.json"] }, () =>
      JSON.stringify({ results: [] }),
    );
    expect(summary).toEqual({ run: { next: [] } });
    expect(summaryPackageCounts(summary)).toBeUndefined();
    expect(summaryVersions(summary)).toBeUndefined();
  });

  it("an old summary, written before counts and versions, reads as carrying none", () => {
    const old = JSON.parse(JSON.stringify({ clean: { next: [] } }));
    expect(summaryPackageCounts(old)).toBeUndefined();
    expect(summaryVersions(old)).toBeUndefined();
  });

  it("will not let a variation pose as a reserved key", () => {
    const { summary, skipped } = buildSummary(
      { name: "2026-10-19", files: ["next-#versions.json"] },
      () => JSON.stringify({ results: [] }),
    );
    expect(summaryVersions(summary)).toBeUndefined();
    expect(skipped).toEqual(["next-#versions.json"]);
  });
});
