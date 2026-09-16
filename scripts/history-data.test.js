const assert = require("node:assert/strict");
const test = require("node:test");
const { extractDayData } = require("../app/src/lib/history-data.ts");

const dataset = (data) => ({
  data,
  variations: Object.keys(data),
  packageManagers: ["npm", "vlt"],
});

test("registry history prefers total seconds when both sources exist", () => {
  const result = extractDayData({
    chartData: dataset({}),
    registryChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 3, vlt: 2 }],
    }),
    registryPerPackageCountChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 90.18, vlt: 60.14 }],
    }),
  });
  assert.deepEqual(result["registry-clean"], { npm: 3, vlt: 2 });
});

test("legacy totals in chartData remain in seconds even with normalized data", () => {
  const result = extractDayData({
    chartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 3, vlt: 2 }],
    }),
    perPackageCountChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 90.18, vlt: 60.14 }],
    }),
    registryPerPackageCountChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 90.18, vlt: 60.14 }],
    }),
  });
  assert.deepEqual(result["registry-clean"], { npm: 3, vlt: 2 });
});

test("per-package-only registry history is skipped rather than mislabeled", () => {
  const result = extractDayData({
    chartData: dataset({}),
    perPackageCountChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 90.18 }],
    }),
    registryPerPackageCountChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 90.18 }],
    }),
  });
  assert.equal(result["registry-clean"], undefined);
  assert.deepEqual(extractDayData({}), {});
});

test("dedicated totals override legacy totals per variation", () => {
  const result = extractDayData({
    chartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 100 }],
      "registry-lockfile": [{ fixture: "next", npm: 4 }],
    }),
    registryChartData: dataset({
      "registry-clean": [{ fixture: "next", npm: 3 }],
    }),
  });
  assert.deepEqual(result, {
    "registry-clean": { npm: 3 },
    "registry-lockfile": { npm: 4 },
  });
});

test("PM normalization and seconds aggregation across fixtures remain intact", () => {
  const result = extractDayData({
    chartData: dataset({ clean: [{ fixture: "next", npm: 1 }] }),
    perPackageCountChartData: dataset({
      clean: [{ fixture: "next", npm: 20 }],
    }),
    registryChartData: dataset({
      "registry-clean": [
        { fixture: "next", npm: 3, vlt: 2 },
        { fixture: "astro", npm: 5, vlt: 4 },
      ],
    }),
  });
  assert.deepEqual(result, {
    clean: { npm: 20 },
    "registry-clean": { npm: 4, vlt: 3 },
  });
});
