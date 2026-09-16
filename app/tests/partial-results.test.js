import assert from "node:assert/strict";
import test from "node:test";
import { partialResultLabel } from "../src/lib/run-completeness.ts";
import {
  calculateAverageVariationData,
  calculateLeaderboard,
} from "../src/lib/utils.ts";
import {
  extractDayData,
  hasPartialResult,
} from "../src/hooks/use-history-data.ts";

const complete = {
  fixture: "next",
  npm: 5,
  vlt: 4,
  npm_statistic: "median",
  vlt_statistic: "median",
};
const partial = {
  ...complete,
  fixture: "astro",
  npm: 0.1,
  vlt: 3,
  npm_partial: true,
  npm_attempted_runs: 3,
  npm_successful_runs: 1,
  npm_dropped_runs: 2,
};
const dataSet = {
  variations: ["clean"],
  data: { clean: [complete, partial] },
  packageManagers: ["npm", "vlt"],
  colors: { npm: "#cb0606", vlt: "#000000" },
};
const chartData = {
  date: "2026-09-15",
  chartData: dataSet,
  perPackageCountChartData: dataSet,
};

test("partial labels show attempted and successful counts without inferring historical completeness", () => {
  assert.equal(
    partialResultLabel(partial, "npm"),
    "Partial: 1/3 runs succeeded",
  );
  assert.equal(
    partialResultLabel({ npm_partial: true }, "npm"),
    "Partial result",
  );
  assert.equal(partialResultLabel(complete, "npm"), undefined);
});

test("a partial command cannot rank using only its other successful fixtures", () => {
  const ranking = calculateLeaderboard(chartData, "clean", "package-managers");
  assert.deepEqual(
    ranking.map((row) => row.packageManager),
    ["vlt"],
  );
  // Restricting to a fixture with complete results permits normal comparisons.
  assert.equal(
    calculateLeaderboard(
      chartData,
      "clean",
      "package-managers",
      new Set(["next"]),
    ).length,
    2,
  );
});

test("synthetic averages keep partial labels and run counts", () => {
  const average = calculateAverageVariationData(chartData);
  assert.equal(
    average.find((row) => row.fixture === "astro").npm_partial,
    true,
  );
  assert.equal(
    average.find((row) => row.fixture === "astro").npm_attempted_runs,
    3,
  );
  assert.equal(
    average.find((row) => row.fixture === "next").npm_partial,
    undefined,
  );
});

test("daily history omits the entire partial command instead of averaging only surviving fixtures", () => {
  assert.deepEqual(extractDayData(chartData), { clean: { vlt: 3.5 } });
  assert.equal(hasPartialResult(chartData, ["clean", "cache"], "npm"), true);
  assert.equal(hasPartialResult(chartData, ["clean", "cache"], "vlt"), false);
});

test("complete median results remain usable and DNF placeholders are excluded", () => {
  const response = {
    ...chartData,
    perPackageCountChartData: {
      ...dataSet,
      data: {
        clean: [
          complete,
          { ...complete, fixture: "astro", npm: 100, npm_dnf: true, vlt: 6 },
        ],
      },
    },
  };
  assert.deepEqual(extractDayData(response), { clean: { npm: 5, vlt: 5 } });
});
