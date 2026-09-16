import assert from "node:assert/strict";
import test from "node:test";
import { extractDayData } from "../src/hooks/use-history-data.ts";
import {
  calculateAverageVariationData,
  calculateLeaderboard,
} from "../src/lib/utils.ts";
import type {
  BenchmarkChartData,
  FixtureResult,
} from "../src/types/chart-data.ts";

const row: FixtureResult = {
  fixture: "next",
  vlt: 4,
  npm: 5,
  vlt_statistic: "median",
  npm_statistic: "median",
  vlt_stddev: 167,
  npm_stddev: 1,
};
const chart = (data: Record<string, FixtureResult[]>) =>
  ({
    chartData: {
      data,
      variations: Object.keys(data),
      packageManagers: ["vlt", "npm"],
      colors: {},
    },
    perPackageCountChartData: {
      data,
      variations: Object.keys(data),
      packageManagers: ["vlt", "npm"],
      colors: {},
    },
    versions: {},
  }) as BenchmarkChartData;

test("aggregate uses medians, labels average-of-medians, and does not invent dispersion", () => {
  const result = calculateAverageVariationData(
    chart({ clean: [row], lockfile: [{ ...row, vlt: 6 }] }),
  );
  assert.equal(result[0].vlt, 5);
  assert.equal(result[0].vlt_statistic, "average-of-medians");
  assert.equal(result[0].vlt_variation_count, 2);
  assert.equal(result[0].vlt_stddev, undefined);
  const ranking = calculateLeaderboard(
    chart({ clean: [row] }),
    "clean",
    "package-managers",
  );
  assert.equal(ranking[0].packageManager, "vlt");
  assert.equal(ranking[0].averageTime, 4);
  assert.equal(ranking[0].wins, 1);
});

test("a partial sample cannot improve a PM's aggregate or leaderboard by dropping its slow case", () => {
  const data = chart({
    clean: [row],
    lockfile: [{ ...row, vlt: 1, vlt_partial: true }],
  });
  assert.equal(calculateAverageVariationData(data)[0].vlt, undefined);
  assert.equal(
    calculateLeaderboard(data, "average", "package-managers").some(
      (r) => r.packageManager === "vlt",
    ),
    false,
  );
});

test("history averages complete medians and omits legacy means and partial comparison sets", () => {
  const response = (rows: FixtureResult[]) => ({
    date: "2026-09-15",
    chartData: {
      variations: ["clean"],
      data: { clean: rows },
      packageManagers: ["vlt", "npm"],
    },
  });
  const day = extractDayData(
    response([row, { ...row, fixture: "astro", vlt: 6 }]),
  );
  assert.equal(day.clean.vlt, 5);
  assert.equal(day.clean.npm, 5);
  const legacy = { ...row };
  delete legacy.vlt_statistic;
  assert.equal(extractDayData(response([legacy])).clean.vlt, undefined);
  const partial = extractDayData(
    response([row, { ...row, vlt_partial: true }]),
  );
  assert.equal(partial.clean.vlt, undefined);
  assert.equal(partial.clean.npm, 5);
});
