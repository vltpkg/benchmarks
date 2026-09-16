const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  benchmarkStatistics,
  formatBenchmarkSummary,
} = require("./benchmark-statistics.js");
const { normalizeTiming } = require("./generate-chart.js");

const outlier = {
  command: "vlt",
  mean: 100.333,
  median: 4,
  times: [294, 3, 4],
  exit_codes: [0, 0, 0],
};

test("median resists extreme outlier while retaining measured run 0 and full range", () => {
  const stats = benchmarkStatistics(outlier);
  assert.equal(stats.value, 4);
  assert.equal(stats.sampleCount, 3);
  assert.equal(stats.min, 3);
  assert.equal(stats.max, 294);
  assert.equal(stats.statistic, "median");
  assert.equal(stats.partial, false);
  assert.equal(benchmarkStatistics({ times: [100, 2] }).value, 51);
  assert.equal(benchmarkStatistics({ times: [9] }).value, 9);
  assert.match(
    formatBenchmarkSummary(outlier),
    /4s \(median; 3\/3 successful runs; range 3s–294s\)/,
  );
  const normalized = normalizeTiming(outlier, 100, true);
  assert.equal(normalized.value, 40);
  assert.equal(normalized.min, 30);
  assert.equal(normalized.max, 2940);
  assert.equal(normalized.sampleCount, 3);
});

test("partial survivors are labeled; all-failed samples stay DNF; legacy mean is explicit", () => {
  const partial = benchmarkStatistics({ ...outlier, exit_codes: [124, 0, 0] });
  assert.equal(partial.value, 3.5);
  assert.equal(partial.partial, true);
  assert.equal(partial.sampleCount, 2);
  assert.equal(partial.attemptedRuns, 3);
  assert.equal(
    benchmarkStatistics({ times: [0], exit_codes: [1] }).failed,
    true,
  );
  assert.equal(benchmarkStatistics({ mean: 100 }).statistic, "legacy-mean");
  assert.equal(benchmarkStatistics({ mean: 100, median: 4 }).value, 4);
  assert.equal(benchmarkStatistics({ mean: "100", median: "4" }).value, 4);
});

test("processing publishes the same median and metadata to dated/latest PM and registry data", (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "median-processing-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.symlinkSync(__dirname, path.join(temp, "scripts"), "dir");
  for (const variation of ["clean", "registry-clean"]) {
    const dir = path.join(temp, "results", "next", variation);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "benchmarks.json"),
      JSON.stringify({
        results: [
          outlier,
          { command: "npm", times: [300, 5, 6], exit_codes: [124, 0, 0] },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(dir, "package-count.json"),
      JSON.stringify({ vlt: { count: 100 }, npm: { count: 100 } }),
    );
  }
  const run = () => {
    const result = spawnSync(
      "bash",
      [path.join(__dirname, "process-results.sh")],
      {
        cwd: temp,
        encoding: "utf8",
        env: { ...process.env, BENCH_DATE: "2026-09-15", GITHUB_SHA: "test" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /vlt: 4s \(median; 3\/3 successful runs/);
    return JSON.parse(
      fs.readFileSync(path.join(temp, "results/latest/chart-data.json")),
    );
  };
  const chart = run();
  assert.deepEqual(run(), chart, "reprocessing preserves partial counts");
  for (const [key, variation, value, min, max] of [
    ["chartData", "clean", 4, 3, 294],
    ["perPackageCountChartData", "clean", 40, 30, 2940],
    ["registryChartData", "registry-clean", 4, 3, 294],
    ["registryPerPackageCountChartData", "registry-clean", 40, 30, 2940],
  ]) {
    const row = chart[key].data[variation][0];
    assert.equal(row.vlt, value);
    assert.equal(row.vlt_statistic, "median");
    assert.equal(row.vlt_sample_count, 3);
    assert.equal(row.vlt_min, min);
    assert.equal(row.vlt_max, max);
    assert.equal(row.npm_partial, true);
    assert.equal(row.npm_successful_runs, 2);
    assert.equal(row.npm_attempted_runs, 3);
  }
  assert.deepEqual(
    chart,
    JSON.parse(
      fs.readFileSync(path.join(temp, "results/2026-09-15/chart-data.json")),
    ),
  );
});
