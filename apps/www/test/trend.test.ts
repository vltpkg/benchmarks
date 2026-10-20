import { describe, expect, it } from "vitest";
import type { BenchmarkFile } from "@benchmarks/types";
import {
  applyExclusions,
  flagOutliers,
  metricRows,
  rollingMedian,
  stepChange,
} from "../src/lib/figures.ts";
import { trendPoint } from "../src/lib/load.ts";

const result = (command: string, mean: number, exit = 0) => ({
  command,
  mean,
  stddev: mean * 0.1,
  median: mean,
  min: mean,
  max: mean,
  user: 0,
  system: 0,
  times: [mean],
  exit_codes: [exit],
});
const file = (...results: ReturnType<typeof result>[]): BenchmarkFile =>
  ({ results }) as unknown as BenchmarkFile;

describe("trendPoint", () => {
  it("plots a tool only on a day it completed every fixture that ran", () => {
    const p = trendPoint("2026-10-02", [
      { fixture: "astro", file: file(result("zpm", 1), result("npm", 4)) },
      { fixture: "babylon", file: file(result("zpm", 0, 1), result("npm", 40)) },
    ]);
    expect(p?.byTool).toEqual({ npm: 22 });
    // The 0.000s crash is neither plotted nor averaged into the partial mean.
    expect(p?.partial.zpm).toEqual({ mean: 1, of: 1 });
    expect(p?.failed.zpm).toEqual([{ fixture: "babylon", exit: 1 }]);
    expect(p?.byFixture.npm).toEqual({ astro: 4, babylon: 40 });
  });

  it("computes per-package time only where every fixture has a count", () => {
    const p = trendPoint(
      "d",
      [
        { fixture: "a", file: file(result("npm", 2)) },
        { fixture: "b", file: file(result("npm", 4)) },
      ],
      [
        { fixture: "a", counts: { npm: { count: 100 } } as never },
        { fixture: "b", counts: { npm: { count: 400 } } as never },
      ],
    );
    expect(p?.perPackage?.npm).toBe((20 + 10) / 2);
  });
});

describe("applyExclusions", () => {
  const trend = [
    { date: "d1", byTool: { npm: 1, bun: 1 } },
    { date: "d2", byTool: { npm: 2, bun: 2 } },
  ];
  it("drops a whole run, or one tool's point on it", () => {
    expect(applyExclusions(trend, ["d1"]).map((p) => p.date)).toEqual(["d2"]);
    expect(applyExclusions(trend, ["bun@d2"])[1]?.byTool).toEqual({ npm: 2 });
  });
});

describe("flagOutliers", () => {
  it("flags a spike and leaves ordinary noise alone", () => {
    const flags = flagOutliers([10, 10.2, 9.9, 10.1, 15, 10, 10.1, 9.8, null, 10]);
    expect(flags[4]).toBeCloseTo(0.5, 1);
    expect(flags.filter((f) => f !== null)).toHaveLength(1);
  });
  it("needs four neighbours to judge a run", () => {
    expect(flagOutliers([1, 1, 9])).toEqual([null, null, null]);
  });
});

describe("rollingMedian and stepChange", () => {
  it("smooths across holes without filling them", () => {
    expect(rollingMedian([1, null, 9, 1, 1])).toEqual([1, null, 1, 1, 1]);
  });
  it("measures a level change at a run", () => {
    const step = stepChange([10, 10, 10, 10, 8, 8, 8, 8], 4);
    expect(step?.change).toBeCloseTo(-0.2);
    expect(stepChange([10, 8], 1)).toBeNull();
  });
});

describe("metricRows", () => {
  const rows = [
    { date: "d1", npm: 10, bun: 2 },
    { date: "d2", npm: 20, bun: null },
    { date: "d3", npm: 10, bun: 3 },
  ];
  it("change starts every line at zero", () => {
    const out = metricRows(rows, ["npm", "bun"], "change", "npm");
    expect(out.map((r) => r.npm)).toEqual([0, 100, 0]);
    expect(out.map((r) => r.bun)).toEqual([0, null, 50]);
  });
  it("baseline is a ratio only where both ran", () => {
    const out = metricRows(rows, ["npm", "bun"], "baseline", "npm");
    expect(out.map((r) => r.bun)).toEqual([0.2, null, 0.3]);
  });
});
