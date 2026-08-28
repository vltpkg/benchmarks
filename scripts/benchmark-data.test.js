const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const { normalizeTiming } = require("./generate-chart.js");

test("normalizes per-package timing and standard deviation", () => {
  assert.deepEqual(normalizeTiming({ mean: 1.2, stddev: 0.12 }, 60, true), {
    value: 20,
    stddev: 2,
  });
});

test("does not mix total seconds into per-package data without a count", () => {
  assert.equal(
    normalizeTiming({ mean: 1.2, stddev: 0.12 }, undefined, true),
    undefined,
  );
  assert.equal(
    normalizeTiming({ mean: 1.2, stddev: 0.12 }, 0, true),
    undefined,
  );
});

test("preserves total timing units", () => {
  assert.deepEqual(
    normalizeTiming({ mean: 1.2, stddev: 0.12 }, undefined, false),
    {
      value: 1.2,
      stddev: 0.12,
    },
  );
});

for (const fixture of [
  {
    name: "pnpm 11 YAML",
    modules: "packageManager: pnpm@11.0.0\n",
    expectedFile: "pnpm-count.txt",
  },
  {
    name: "pnpm 12 JSON",
    modules: '{\n  "packageManager": "pnpm@12.0.0"\n}\n',
    expectedFile: "pacquet-count.txt",
  },
]) {
  test(`attributes package counts from ${fixture.name} metadata`, (t) => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "package-count-test-"),
    );
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const outputDir = path.join(tempDir, "results");
    const packageDir = path.join(tempDir, "node_modules", "example");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'\n",
    );
    fs.writeFileSync(
      path.join(tempDir, "node_modules", ".modules.yaml"),
      fixture.modules,
    );
    fs.writeFileSync(
      path.join(packageDir, "package.json"),
      '{"name":"example"}\n',
    );

    const result = spawnSync(
      "bash",
      [path.join(__dirname, "package-count.sh"), outputDir],
      { cwd: tempDir, encoding: "utf8" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(outputDir, fixture.expectedFile), "utf8"),
      "1\n",
    );
  });
}
