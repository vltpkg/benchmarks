import { describe, expect, it } from "vitest";
import { buildSummary } from "../src/summary.ts";

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
    });
    expect(Object.prototype).not.toHaveProperty("next");
    expect(skipped).toEqual(["astro-clean.json", "vue-clean.json"]);
  });
});
