const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const temporaryDirectory = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "partial-results-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};

const runScript = (script, args, cwd) => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, script), ...args],
    {
      cwd,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
};

const rawResult = (exit_codes, times = [1, 2, 300]) => ({
  command: "npm",
  times,
  exit_codes,
  mean: 101,
  stddev: 140,
  median: 2,
  min: 1,
  max: 300,
  user: 90,
  system: 10,
});

for (const scenario of [
  {
    name: "complete success",
    codes: [0, 0, 0],
    status: "success",
    successes: 3,
  },
  {
    name: "partial success",
    codes: [0, 0, 124],
    status: "partial",
    successes: 2,
  },
  {
    name: "single survivor",
    codes: [0, 1, 124],
    status: "partial",
    successes: 1,
  },
  {
    name: "total failure",
    codes: [1, 2, 124],
    status: "failure",
    successes: 0,
  },
]) {
  test(`preserves outcomes for ${scenario.name}, including repeated cleanup`, (t) => {
    const directory = temporaryDirectory(t);
    const file = path.join(directory, "benchmarks.json");
    fs.writeFileSync(
      file,
      JSON.stringify({ results: [rawResult(scenario.codes)] }),
    );
    runScript("clean-benchmarks.js", [directory], directory);
    const cleaned = JSON.parse(fs.readFileSync(file, "utf8")).results[0];
    assert.equal(cleaned.attempted_runs, 3);
    assert.equal(cleaned.successful_runs, scenario.successes);
    assert.equal(cleaned.dropped_runs, 3 - scenario.successes);
    assert.equal(cleaned.status, scenario.status);
    assert.deepEqual(cleaned.original_exit_codes, scenario.codes);
    if (scenario.successes === 3) {
      assert.equal(cleaned.user, 90);
      assert.equal(cleaned.system, 10);
    } else {
      assert.equal(Object.hasOwn(cleaned, "user"), false);
      assert.equal(Object.hasOwn(cleaned, "system"), false);
    }
    if (scenario.successes > 0) {
      assert.deepEqual(cleaned.times, [1, 2, 300].slice(0, scenario.successes));
      assert.deepEqual(cleaned.exit_codes, Array(scenario.successes).fill(0));
      assert.equal(cleaned.mean, [0, 1, 1.5, 101][scenario.successes]);
      if (scenario.successes === 1) assert.equal(cleaned.stddev, null);
    } else {
      // Preserve the historical DNF sentinel for existing downstream consumers.
      assert.equal(cleaned.mean, 0);
      assert.deepEqual(cleaned.exit_codes, [1]);
    }
    runScript("clean-benchmarks.js", [directory], directory);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(file, "utf8")).results[0],
      cleaned,
    );
  });
}

test("chart generation preserves partial metadata for PMs and registries in both units", (t) => {
  const directory = temporaryDirectory(t);
  const date = "2026-09-15";
  const resultDirectory = path.join(directory, "results", date);
  fs.mkdirSync(resultDirectory, { recursive: true });
  const file = path.join(directory, "benchmarks.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      results: [
        rawResult([0, 1, 124]),
        { ...rawResult([1, 1, 124]), command: "vlt" },
        { ...rawResult([0, 0, 0]), command: "bun" },
      ],
    }),
  );
  runScript("clean-benchmarks.js", [file], directory);
  for (const variation of ["clean", "registry-clean"]) {
    fs.copyFileSync(file, path.join(resultDirectory, `next-${variation}.json`));
    fs.writeFileSync(
      path.join(resultDirectory, `next-${variation}-package-count.json`),
      JSON.stringify({
        npm: { count: 100 },
        vlt: { count: 100 },
        bun: { count: 100 },
      }),
    );
  }
  runScript("generate-chart.js", [date], directory);
  const output = JSON.parse(
    fs.readFileSync(path.join(resultDirectory, "chart-data.json"), "utf8"),
  );
  for (const [key, variation, value] of [
    ["chartData", "clean", 1],
    ["perPackageCountChartData", "clean", 10],
    ["registryChartData", "registry-clean", 1],
    ["registryPerPackageCountChartData", "registry-clean", 10],
  ]) {
    const row = output[key].data[variation][0];
    assert.equal(row.npm, value);
    assert.equal(row.npm_partial, true);
    assert.equal(row.npm_attempted_runs, 3);
    assert.equal(row.npm_successful_runs, 1);
    assert.equal(row.npm_dropped_runs, 2);
    assert.equal(Object.hasOwn(row, "npm_stddev"), false);
    assert.equal(row.vlt_dnf, true);
    assert.equal(row.vlt_successful_runs, 0);
    assert.equal(row.vlt_dropped_runs, 3);
    assert.equal(row.bun_partial, undefined);
  }
});

test("historical output remains readable without inventing completeness counts", (t) => {
  const directory = temporaryDirectory(t);
  const date = "2025-01-01";
  const resultDirectory = path.join(directory, "results", date);
  fs.mkdirSync(resultDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(resultDirectory, "next-clean.json"),
    JSON.stringify({
      results: [{ command: "npm", mean: 2, stddev: 0.5, exit_codes: [0, 0] }],
    }),
  );
  // An all-DNF fixture must still reach the table even without a timing fallback.
  fs.writeFileSync(
    path.join(resultDirectory, "next-build.json"),
    JSON.stringify({
      results: [{ command: "npm", mean: 0, stddev: 0, exit_codes: [1] }],
    }),
  );
  runScript("generate-chart.js", [date], directory);
  const output = JSON.parse(
    fs.readFileSync(path.join(resultDirectory, "chart-data.json"), "utf8"),
  );
  const row = output.chartData.data.clean[0];
  assert.equal(row.npm, 2);
  assert.equal(Object.hasOwn(row, "npm_attempted_runs"), false);
  assert.equal(Object.hasOwn(row, "npm_partial"), false);
  assert.equal(output.chartData.data.build[0].npm_dnf, true);
});

test("CI scans raw exit codes before processing results", () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/benchmark.yaml"),
    "utf8",
  );
  const rawScan = workflow.indexOf("- name: Scan Raw Registry Results");
  const processResults = workflow.indexOf("- name: Process Results");
  assert.ok(rawScan >= 0 && rawScan < processResults);
});
