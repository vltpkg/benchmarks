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

test("clean_node_modules removes the workspaces' node_modules too, not the tools' stores", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clean-node-modules-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = [
    "node_modules/.vlt/a/node_modules/a/package.json",
    "packages/dev/core/node_modules/.bin/a",
    "packages/dev/core/src/index.ts",
    "packages/public/@scope/gui/node_modules/@scope/core/package.json",
    "packages/public/@scope/gui/package.json",
    ".aube/store/node_modules/b/package.json",
    ".upm-store/b/node_modules/b/package.json",
  ];
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), "");
  }
  // what vlt leaves once the root node_modules is gone: a dangling symlink
  fs.symlinkSync(
    "../../../../node_modules/.vlt/a/node_modules/a",
    path.join(dir, "packages/dev/core/node_modules/a"),
  );

  const result = spawnSync(
    "bash",
    ["-c", `source "$HELPERS" >/dev/null; clean_node_modules`],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, HELPERS: path.join(__dirname, "clean-helpers.sh") },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const exists = (file) => fs.existsSync(path.join(dir, file));
  assert.equal(exists("node_modules"), false);
  assert.equal(exists("packages/dev/core/node_modules"), false);
  assert.equal(exists("packages/public/@scope/gui/node_modules"), false);
  assert.equal(exists("packages/dev/core/src/index.ts"), true);
  assert.equal(exists("packages/public/@scope/gui/package.json"), true);
  assert.equal(exists(".aube/store/node_modules/b/package.json"), true);
  assert.equal(exists(".upm-store/b/node_modules/b/package.json"), true);
});

// The environment the helpers run in: the test process's, minus any
// BENCH_RUN_ID, so a benchmark running on this machine can't scope the tests.
const baseEnv = { ...process.env };
delete baseEnv.BENCH_RUN_ID;
// `runId` set: the helper runs as that benchmark run; unset: no run id.
const helperEnv = (runId, extra = {}) =>
  runId === undefined ? { ...baseEnv, ...extra } : { ...baseEnv, BENCH_RUN_ID: runId, ...extra };

// A stand-in for one of vlt's detached children: `sleep` copied to a file
// with the given name, so pgrep sees that process name (truncated to 15
// characters, as Linux does), or a node script at a vlt-style path when
// `script` is set. Started from a throwaway sh, like vlt's detached children,
// so it is reaped when it exits instead of lingering as a zombie of this
// (blocked) test process. `runId` puts BENCH_RUN_ID in its environment, as a
// child of that benchmark run would have. Returns its pid.
const startFake = (t, seconds, { name = "vlt-cache-unzip", script, runId } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vlt-child-test-"));
  let argv;
  if (script) {
    const file = path.join(dir, "node_modules", "vlt", script);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `setTimeout(() => {}, ${seconds * 1000});\n`);
    argv = [process.execPath, file];
  } else {
    const bin = path.join(dir, name);
    fs.copyFileSync(execFileSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).trim(), bin);
    fs.chmodSync(bin, 0o755);
    argv = [bin, String(seconds)];
  }
  const pid = Number(
    execFileSync("sh", ["-c", `"$@" >/dev/null 2>&1 & echo $!`, "sh", ...argv], {
      encoding: "utf8",
      env: helperEnv(runId),
    }),
  );
  t.after(() => {
    try {
      process.kill(pid);
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return pid;
};
const startFakeUnzip = (t, seconds, opts) => startFake(t, seconds, opts);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Runs `command` after sourcing clean-helpers.sh, as benchmark run `runId`
// (unset: no run id).
const runHelper = (command, runId) =>
  spawnSync("bash", ["-c", `source "$HELPERS" >/dev/null; ${command}`], {
    encoding: "utf8",
    env: helperEnv(runId, { HELPERS: path.join(__dirname, "clean-helpers.sh") }),
  });

const waitForVltBackground = (limit, runId) =>
  runHelper(`wait_for_vlt_background ${limit}`, runId);

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

test("wait_for_vlt_background: waits for a child of this run", (t) => {
  startFakeUnzip(t, 1.5, { runId: "run-a" });
  const start = Date.now();
  const result = waitForVltBackground(10, "run-a");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - start >= 1200, "returned before the process exited");
});

test("wait_for_vlt_background: ignores children of other runs and of no run", (t) => {
  startFakeUnzip(t, 30, { runId: "run-b" });
  startFakeUnzip(t, 30);
  const start = Date.now();
  const result = waitForVltBackground(5, "run-a");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - start < 2000, "waited on another run's process");
});

test("wait_for_vlt_background: with no run id, waits for any run's child", (t) => {
  startFakeUnzip(t, 1.5, { runId: "run-b" });
  const start = Date.now();
  const result = waitForVltBackground(10);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - start >= 1200, "returned before the process exited");
});

test("stop_vlt_background: stops only this run's children", (t) => {
  const own = startFakeUnzip(t, 30, { runId: "run-a" });
  const ownScript = startFake(t, 30, { script: "cache-unzip-src-unzip.js", runId: "run-a" });
  const other = startFakeUnzip(t, 30, { runId: "run-b" });
  const none = startFakeUnzip(t, 30);
  execFileSync("sleep", ["0.3"]);
  const result = runHelper("wait_for_vlt_background 1 || stop_vlt_background", "run-a");
  assert.equal(result.status, 0, result.stderr);
  execFileSync("sleep", ["0.3"]);
  assert.equal(alive(own), false, "this run's child is still running");
  assert.equal(alive(ownScript), false, "this run's script child is still running");
  assert.equal(alive(other), true, "another run's child was stopped");
  assert.equal(alive(none), true, "a child of no run was stopped");
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

const vltBackgroundRunning = (runId) =>
  spawnSync("bash", ["-c", `source "$VB"; vlt_background_running`], {
    env: helperEnv(runId, { VB: path.join(__dirname, "vlt-background.sh") }),
  }).status;

test("vlt_background_running: false when nothing is running", () => {
  assert.equal(vltBackgroundRunning(), 1);
});

for (const [label, opts] of [
  ["a renamed child, by its truncated name (vlt-cache-revalidate)", { name: "vlt-cache-revalidate" }],
  ["a child that keeps its command line (rollback-remove)", { script: "rollback-remove-src-remove.js" }],
  ["a child before it renames itself", { script: "registry-client-src-revalidate.js" }],
]) {
  test(`vlt_background_running: matches ${label}`, (t) => {
    startFake(t, 30, opts);
    // Give sh a moment to exec the child.
    execFileSync("sleep", ["0.3"]);
    assert.equal(vltBackgroundRunning(), 0);
  });
  test(`vlt_background_running: matches ${label} only for its run`, (t) => {
    startFake(t, 30, { ...opts, runId: "run-a" });
    execFileSync("sleep", ["0.3"]);
    assert.equal(vltBackgroundRunning("run-a"), 0);
    assert.equal(vltBackgroundRunning("run-b"), 1);
    assert.equal(vltBackgroundRunning(), 0, "no run id should match any run's child");
  });
}

// Record what a cleaner removes, without touching anything real.
const removedBy = (command, env = {}, bins = {}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleaner-test-"));
  try {
    const removeLog = path.join(tempDir, "removed.txt");
    fs.writeFileSync(removeLog, "");
    fs.mkdirSync(path.join(tempDir, "bin"));
    for (const [name, script] of Object.entries(bins)) {
      fs.writeFileSync(path.join(tempDir, "bin", name), script, { mode: 0o755 });
    }
    const result = spawnSync(
      "bash",
      ["-c", `source "$HELPERS" >/dev/null; safe_remove() { printf '%s\\n' "$1" >> "$REMOVE_LOG"; }; ${command}`],
      {
        encoding: "utf8",
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${path.join(tempDir, "bin")}${path.delimiter}${process.env.PATH}`,
          HOME: "/home/runner",
          HELPERS: path.join(__dirname, "clean-helpers.sh"),
          REMOVE_LOG: removeLog,
          ...env,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return fs.readFileSync(removeLog, "utf8").trim().split("\n").filter(Boolean);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

test("clean_yarn_cache removes Yarn 1's cache, with and without XDG_CACHE_HOME", () => {
  assert.deepEqual(removedBy("clean_yarn_cache", { XDG_CACHE_HOME: "" }).slice(-1), [
    "/home/runner/.cache/yarn",
  ]);
  assert.deepEqual(removedBy("clean_yarn_cache", { XDG_CACHE_HOME: "/xdg/cache" }).slice(-1), [
    "/xdg/cache/yarn",
  ]);
});

test("clean_zpm_cache removes ~/.yarn/zpm", () => {
  assert.deepEqual(removedBy("clean_zpm_cache"), ["/home/runner/.yarn/zpm"]);
});

test("clean_berry_cache removes berry's global folder, with and without XDG_DATA_HOME", () => {
  assert.deepEqual(removedBy("clean_berry_cache", { XDG_DATA_HOME: "" }), [
    "/home/runner/.yarn/berry",
    "/home/runner/.local/share/yarn/berry",
  ]);
  assert.deepEqual(removedBy("clean_berry_cache", { XDG_DATA_HOME: "/xdg/data" }), [
    "/home/runner/.yarn/berry",
    "/xdg/data/yarn/berry",
  ]);
});

test("clean_bun_cache removes bun's install folder, under $HOME and under XDG_CACHE_HOME", () => {
  // a `bun` that does nothing, so the test never touches a real bun cache
  const bins = { bun: "#!/bin/sh\nexit 0\n" };
  assert.deepEqual(removedBy("clean_bun_cache", { XDG_CACHE_HOME: "" }, bins), [
    "/home/runner/.bun/install",
  ]);
  assert.deepEqual(removedBy("clean_bun_cache", { XDG_CACHE_HOME: "/xdg/cache" }, bins), [
    "/home/runner/.bun/install",
    "/xdg/cache/.bun/install",
  ]);
  assert.deepEqual(
    removedBy("clean_bun_cache", { XDG_CACHE_HOME: "", BUN_INSTALL_CACHE_DIR: "/custom" }, bins),
    ["/home/runner/.bun/install", "/custom"],
  );
});

// A git repository with the given files committed: what a fixture looks like.
const committedRepo = (dir, files) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@t",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@t",
      },
    });
  git("init", "-q");
  git("add", ".");
  git("commit", "-q", "-m", "fixture");
};

test("clean_fixture_config restores a tracked .gitignore and .yarnrc.yml, removes an untracked .yarnrc.yml", (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fixture-config-test-"));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const run = (cwd) => {
    const result = spawnSync("bash", ["-c", 'source "$HELPERS" >/dev/null; clean_fixture_config'], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, HELPERS: path.join(__dirname, "clean-helpers.sh") },
    });
    assert.equal(result.status, 0, result.stderr);
  };

  // like next: both files committed; turbo's build appends to .gitignore
  const next = path.join(tempDir, "next");
  committedRepo(next, { ".gitignore": "/node_modules\n", ".yarnrc.yml": "nodeLinker: node-modules\n" });
  fs.appendFileSync(path.join(next, ".gitignore"), "\n# Turborepo\n.turbo\n");
  fs.writeFileSync(path.join(next, ".yarnrc.yml"), "enableMirror: false\n");
  run(next);
  assert.equal(fs.readFileSync(path.join(next, ".gitignore"), "utf8"), "/node_modules\n");
  assert.equal(fs.readFileSync(path.join(next, ".yarnrc.yml"), "utf8"), "nodeLinker: node-modules\n");

  // like run: no .yarnrc.yml committed; berry's prepare writes one
  const run_ = path.join(tempDir, "run");
  committedRepo(run_, { ".gitignore": "/node_modules\n", "package.json": "{}" });
  fs.writeFileSync(path.join(run_, ".yarnrc.yml"), "enableMirror: false\n");
  run(run_);
  assert.equal(fs.existsSync(path.join(run_, ".yarnrc.yml")), false);
  assert.equal(fs.readFileSync(path.join(run_, ".gitignore"), "utf8"), "/node_modules\n");

  // outside a repository nothing is touched
  const plain = path.join(tempDir, "plain");
  fs.mkdirSync(plain);
  fs.writeFileSync(path.join(plain, ".yarnrc.yml"), "x\n");
  run(plain);
  assert.equal(fs.existsSync(path.join(plain, ".yarnrc.yml")), true);
});

test("registry-package-count.sh counts by walking the graph, dotted names included", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-count-test-"));
  try {
    const project = path.join(tempDir, "project");
    const out = path.join(tempDir, "out");
    for (const [name, manifest] of [
      ["a", { name: "a", dependencies: { "lodash.merge": "1" } }],
      ["lodash.merge", { name: "lodash.merge" }],
      ["@scope.x/b", { name: "@scope.x/b" }],
      [".store/unreachable", { name: "unreachable" }],
    ]) {
      fs.mkdirSync(path.join(project, "node_modules", name), { recursive: true });
      fs.writeFileSync(path.join(project, "node_modules", name, "package.json"), JSON.stringify(manifest));
    }
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ name: "x", dependencies: { a: "1", "@scope.x/b": "1" } }),
    );
    const script = path.join(__dirname, "registry-package-count.sh");
    for (const registry of ["npm", "aws"]) {
      const result = spawnSync("bash", [script, out, registry], { cwd: project, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    assert.deepEqual(fs.readdirSync(out).sort(), ["aws-count.txt", "npm-count.txt"]);
    assert.equal(fs.readFileSync(path.join(out, "npm-count.txt"), "utf8"), "3\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("clean_nx_cache does nothing outside an Nx workspace", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-clean-test-"));
  try {
    const binDir = path.join(tempDir, "bin");
    const log = path.join(tempDir, "nx-calls.txt");
    fs.mkdirSync(binDir);
    fs.writeFileSync(path.join(binDir, "nx"), `#!/bin/sh\necho "$*" >> "${log}"\n`, { mode: 0o755 });
    const run = (cwd) =>
      spawnSync("bash", ["-c", `source "$HELPERS" >/dev/null; clean_nx_cache`], {
        cwd,
        env: {
          ...process.env,
          PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
          HELPERS: path.join(__dirname, "clean-helpers.sh"),
        },
      }).status;
    const plain = path.join(tempDir, "plain");
    fs.mkdirSync(plain);
    fs.writeFileSync(path.join(plain, "package.json"), '{"name":"x"}');
    assert.equal(run(plain), 0);
    assert.equal(fs.existsSync(log), false, "nx ran outside a workspace");
    const ws = path.join(tempDir, "ws");
    fs.mkdirSync(ws);
    fs.writeFileSync(path.join(ws, "package.json"), '{"name":"x","nx":{}}');
    assert.equal(run(ws), 0);
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), [
      "daemon --stop",
      "clear-cache",
      "reset",
    ]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("package-count.sh files a Yarn 1 lockfile under yarn even with a .yarnrc.yml", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "count-test-"));
  try {
    const project = path.join(tempDir, "project");
    const out = path.join(tempDir, "out");
    fs.mkdirSync(path.join(project, "node_modules", "a"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "node_modules", "a", "package.json"),
      '{"name":"a","version":"1.0.0"}',
    );
    fs.writeFileSync(
      path.join(project, "package.json"),
      '{"name":"x","dependencies":{"a":"1.0.0"}}',
    );
    fs.writeFileSync(path.join(project, ".yarnrc.yml"), "nodeLinker: node-modules\n");
    fs.writeFileSync(
      path.join(project, "yarn.lock"),
      "# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n",
    );
    const result = spawnSync("bash", [path.join(__dirname, "package-count.sh"), out], {
      cwd: project,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(out), ["yarn-count.txt"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("package-count.sh tells zpm from berry by the packageManager pin", () => {
  for (const [packageManager, expected] of [
    ["yarn@6.0.0-rc.20", "zpm-count.txt"],
    ["yarn@4.18.1", "berry-count.txt"],
  ]) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "count-test-"));
    try {
      const project = path.join(tempDir, "project");
      const out = path.join(tempDir, "out");
      fs.mkdirSync(path.join(project, "node_modules", "a"), { recursive: true });
      fs.writeFileSync(
        path.join(project, "node_modules", "a", "package.json"),
        '{"name":"a","version":"1.0.0"}',
      );
      fs.writeFileSync(
        path.join(project, "package.json"),
        JSON.stringify({ name: "x", dependencies: { a: "1.0.0" }, packageManager }),
      );
      fs.writeFileSync(path.join(project, ".yarnrc.yml"), "nodeLinker: node-modules\n");
      fs.writeFileSync(path.join(project, "yarn.lock"), "__metadata:\n  version: 8\n");
      const result = spawnSync("bash", [path.join(__dirname, "package-count.sh"), out], {
        cwd: project,
        encoding: "utf8",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(fs.readdirSync(out), [expected]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

// migrate_workspace_protocol, with a fake vlt that does what
// `vlt install --lockfile-only` does to a workspace: rewrites a sibling range
// to workspace:* and writes vlt-lock.json.
const migrateWorkspaceProtocol = (t, { packages = true, migrated = false, lockfile } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-ws-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const binDir = path.join(dir, "bin");
  const project = path.join(dir, "project");
  const vltLog = path.join(dir, "vlt-calls.txt");
  fs.mkdirSync(binDir);
  fs.mkdirSync(project);
  fs.writeFileSync(
    path.join(binDir, "vlt"),
    `#!/bin/sh
echo "$*" >> "${vltLog}"
sed -i 's/"\\^1\\.0\\.0"/"workspace:*"/' packages/b/package.json
echo '{"lockfileVersion":1,"fake":true}' > vlt-lock.json
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(project, "package.json"), '{"name":"x","workspaces":["packages/*"]}');
  if (packages) {
    fs.mkdirSync(path.join(project, "packages", "a"), { recursive: true });
    fs.mkdirSync(path.join(project, "packages", "b"), { recursive: true });
    fs.writeFileSync(path.join(project, "packages", "a", "package.json"), '{"name":"a","version":"1.0.0"}');
    fs.writeFileSync(
      path.join(project, "packages", "b", "package.json"),
      `{"name":"b","dependencies":{"a":${migrated ? '"workspace:*"' : '"^1.0.0"'}}}`,
    );
    // A workspace's node_modules can hold manifests that use workspace:
    // (dependencies installed from a pnpm-style project); they don't count.
    fs.mkdirSync(path.join(project, "packages", "a", "node_modules", "dep"), { recursive: true });
    fs.writeFileSync(
      path.join(project, "packages", "a", "node_modules", "dep", "package.json"),
      '{"name":"dep","dependencies":{"peer":"workspace:^"}}',
    );
  }
  if (lockfile !== undefined) {
    fs.writeFileSync(path.join(project, "vlt-lock.json"), lockfile);
  }
  const result = spawnSync("bash", [path.join(__dirname, "clean-helpers.sh"), "migrate_workspace_protocol"], {
    cwd: project,
    encoding: "utf8",
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr);
  const read = (file) => (fs.existsSync(path.join(project, file)) ? fs.readFileSync(path.join(project, file), "utf8") : null);
  return {
    vltCalls: fs.existsSync(vltLog) ? fs.readFileSync(vltLog, "utf8").trim().split("\n") : [],
    manifest: read("packages/b/package.json"),
    lockfile: read("vlt-lock.json"),
    tempLockfile: read(".bench-vlt-lock.json"),
  };
};

test("migrate_workspace_protocol: migrates the manifests and discards the lockfile", (t) => {
  const out = migrateWorkspaceProtocol(t);
  assert.deepEqual(out.vltCalls, ["install --lockfile-only --view=silent"]);
  assert.equal(out.manifest, '{"name":"b","dependencies":{"a":"workspace:*"}}');
  assert.equal(out.lockfile, null, "the lockfile --lockfile-only wrote was kept");
  assert.equal(out.tempLockfile, null);
});

test("migrate_workspace_protocol: keeps a pre-existing lockfile byte for byte", (t) => {
  const lockfile = '{"lockfileVersion":1,"nodes":{"":["x"]}}\n';
  const out = migrateWorkspaceProtocol(t, { lockfile });
  assert.deepEqual(out.vltCalls, ["install --lockfile-only --view=silent"]);
  assert.equal(out.manifest, '{"name":"b","dependencies":{"a":"workspace:*"}}');
  assert.equal(out.lockfile, lockfile);
  assert.equal(out.tempLockfile, null);
});

test("migrate_workspace_protocol: does nothing without packages/", (t) => {
  const out = migrateWorkspaceProtocol(t, { packages: false, lockfile: "orig" });
  assert.deepEqual(out.vltCalls, []);
  assert.equal(out.lockfile, "orig");
});

test("migrate_workspace_protocol: does nothing once workspace: is present", (t) => {
  const out = migrateWorkspaceProtocol(t, { migrated: true });
  assert.deepEqual(out.vltCalls, []);
  assert.equal(out.manifest, '{"name":"b","dependencies":{"a":"workspace:*"}}');
  assert.equal(out.lockfile, null);
});
