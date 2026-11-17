const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");

for (const scenario of [
  {
    name: "configured store with spaces",
    command: "clean_aube_cache",
    store: true,
  },
  { name: "unavailable store path", command: "clean_aube_cache", store: false },
  {
    name: "metadata-only cleanup",
    command: "clean_aube_metadata_cache",
    store: true,
  },
]) {
  test(`aube cache cleanup: ${scenario.name}`, (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aube-clean-test-"));
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
    const binDir = path.join(tempDir, "bin");
    const store = path.join(tempDir, "custom store", "v1");
    const cache = path.join(tempDir, "xdg cache");
    const removeLog = path.join(tempDir, "removed.txt");
    const commandLog = path.join(tempDir, "commands.txt");
    fs.mkdirSync(binDir);
    fs.writeFileSync(removeLog, "");
    fs.writeFileSync(
      path.join(binDir, "aube"),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG"
if [ "$1" = store ]; then
  [ "$STORE_AVAILABLE" = 1 ] || exit 1
  printf '%s\\n' "$TEST_STORE"
fi
`,
      { mode: 0o755 },
    );

    // Record deletion targets so the test never touches the user's caches.
    const result = spawnSync(
      "bash",
      [
        "-c",
        `
source "$HELPERS" >/dev/null
safe_remove() { printf '%s\\n' "$1" >> "$REMOVE_LOG"; }
"$CLEAN_COMMAND"
`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          HELPERS: path.join(__dirname, "clean-helpers.sh"),
          TEST_STORE: store,
          STORE_AVAILABLE: scenario.store ? "1" : "0",
          XDG_CACHE_HOME: cache,
          REMOVE_LOG: removeLog,
          COMMAND_LOG: commandLog,
          CLEAN_COMMAND: scenario.command,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const removed = fs
      .readFileSync(removeLog, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);
    const commands = fs.readFileSync(commandLog, "utf8").trim().split("\n");
    if (scenario.command === "clean_aube_metadata_cache") {
      assert.deepEqual(removed, []);
      assert.deepEqual(commands, ["cache delete *"]);
    } else {
      assert.deepEqual(removed, [
        ...(scenario.store ? [store] : []),
        path.join(cache, "aube"),
        path.join(os.homedir(), ".aube-store"),
      ]);
      assert.deepEqual(commands, ["cache delete *", "store path"]);
    }
  });
}

// A stand-in for vlt's background unzip: a copy of `sleep` named
// vlt-cache-unzip, so pgrep -x sees the same process name. Started from a
// throwaway sh, like vlt's detached child, so it is reaped when it exits
// instead of lingering as a zombie of this (blocked) test process.
const startFakeUnzip = (t, seconds) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vlt-unzip-test-"));
  const bin = path.join(dir, "vlt-cache-unzip");
  fs.copyFileSync(execFileSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).trim(), bin);
  fs.chmodSync(bin, 0o755);
  const pid = Number(
    execFileSync("sh", ["-c", `"$0" "$1" >/dev/null 2>&1 & echo $!`, bin, String(seconds)], {
      encoding: "utf8",
    }),
  );
  t.after(() => {
    try {
      process.kill(pid);
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
};

const waitForVltBackground = (limit) =>
  spawnSync(
    "bash",
    ["-c", `source "$HELPERS" >/dev/null; wait_for_vlt_background ${limit}`],
    {
      encoding: "utf8",
      env: { ...process.env, HELPERS: path.join(__dirname, "clean-helpers.sh") },
    },
  );

test("wait_for_vlt_background: returns at once when nothing is running", () => {
  const start = Date.now();
  const result = waitForVltBackground(5);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - start < 2000);
});

test("wait_for_vlt_background: waits for vlt-cache-unzip to exit", (t) => {
  startFakeUnzip(t, 1.5);
  const start = Date.now();
  const result = waitForVltBackground(10);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - start >= 1200, "returned before the process exited");
});

test("wait_for_vlt_background: fails after the limit", (t) => {
  startFakeUnzip(t, 30);
  const result = waitForVltBackground(1);
  assert.equal(result.status, 1);
});

test("hyperfine-wait.sh: wraps prepare, setup and cleanup", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hyperfine-wait-test-"));
  try {
    const binDir = path.join(tempDir, "bin");
    const argsLog = path.join(tempDir, "args.json");
    fs.mkdirSync(binDir);
    // Record the arguments the wrapper hands to the real hyperfine.
    fs.writeFileSync(
      path.join(binDir, "hyperfine"),
      `#!/usr/bin/env node\nrequire("fs").writeFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)))\n`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      "bash",
      [
        "-c",
        `source "$WRAPPER"; hyperfine --runs=1 --setup="s" --prepare="p1;" --prepare="exit 3" --cleanup="c" -n x "true"`,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          WRAPPER: path.join(__dirname, "hyperfine-wait.sh"),
          BENCH_SCRIPTS: "/scripts",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(fs.readFileSync(argsLog, "utf8"));
    const wait = "bash /scripts/clean-helpers.sh wait_for_vlt_background";
    assert.deepEqual(args, [
      "--runs=1",
      `--setup=${wait}; s`,
      `--prepare=${wait}; p1;\nbench_prepare_rc=$?; ${wait}; exit $bench_prepare_rc`,
      `--prepare=${wait}; exit 3\nbench_prepare_rc=$?; ${wait}; exit $bench_prepare_rc`,
      `--cleanup=${wait}; c`,
      "-n",
      "x",
      "true",
    ]);

    // The wrapped prepares run under sh (hyperfine's default shell) and keep
    // their own exit status, with the waits stubbed out.
    const run = (prepare) =>
      spawnSync("sh", ["-c", prepare.slice("--prepare=".length).replaceAll(wait, "true")]).status;
    assert.equal(run(args[2]), 127); // `p1` doesn't exist
    assert.equal(run(args[3]), 3);
    assert.equal(run(`--prepare=${wait}; true\nbench_prepare_rc=$?; ${wait}; exit $bench_prepare_rc`), 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
