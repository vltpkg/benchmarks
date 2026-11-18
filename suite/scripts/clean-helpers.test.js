const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
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

// A stand-in for one of vlt's detached children: `sleep` copied to a file
// with the given name, so pgrep sees that process name (truncated to 15
// characters, as Linux does), or a node script at a vlt-style path when
// `script` is set. Started from a throwaway sh, like vlt's detached children,
// so it is reaped when it exits instead of lingering as a zombie of this
// (blocked) test process.
const startFake = (t, seconds, { name = "vlt-cache-unzip", script } = {}) => {
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
    }),
  );
  t.after(() => {
    try {
      process.kill(pid);
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  });
};
const startFakeUnzip = (t, seconds) => startFake(t, seconds);

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

const vltBackgroundRunning = () =>
  spawnSync("bash", ["-c", `source "$VB"; vlt_background_running`], {
    env: { ...process.env, VB: path.join(__dirname, "vlt-background.sh") },
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
}

// Record what a cleaner removes, without touching anything real.
const removedBy = (command, env = {}) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleaner-test-"));
  try {
    const removeLog = path.join(tempDir, "removed.txt");
    fs.writeFileSync(removeLog, "");
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
  assert.deepEqual(removedBy("clean_berry_cache", { XDG_DATA_HOME: "" }).slice(-2), [
    "/home/runner/.yarn/berry",
    "/home/runner/.local/share/yarn/berry",
  ]);
  assert.deepEqual(removedBy("clean_berry_cache", { XDG_DATA_HOME: "/xdg/data" }).slice(-2), [
    "/home/runner/.yarn/berry",
    "/xdg/data/yarn/berry",
  ]);
});

// Run clean_deno_code_cache from `cwd` against a fake deno dir (reported by a
// fake `deno info --json`, or found through env when `denoOnPath` is false)
// and record what it removes and what is left in the code cache database.
const { DatabaseSync } = require("node:sqlite");
const CODECACHE_SCHEMA =
  "CREATE TABLE codecache (specifier TEXT NOT NULL, type INTEGER NOT NULL, source_hash INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (specifier, type))";
const runDenoCodeCacheClean = ({ denoDir, denoOnPath = true, schema, rows = [], env = {} }) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "deno-clean-test-"));
  try {
    const binDir = path.join(tempDir, "bin");
    const cwd = path.join(tempDir, "my project");
    const removeLog = path.join(tempDir, "removed.txt");
    fs.mkdirSync(binDir);
    fs.mkdirSync(cwd);
    fs.writeFileSync(removeLog, "");
    if (denoOnPath) {
      fs.writeFileSync(
        path.join(binDir, "deno"),
        `#!/bin/sh\n[ "$1 $2" = "info --json" ] || exit 1\nprintf '{\\n  "version": 1,\\n  "denoDir": "%s",\\n  "npmCache": "%s/npm"\\n}\\n' "$FAKE_DENO_DIR" "$FAKE_DENO_DIR"\n`,
        { mode: 0o755 },
      );
    }
    const dbPath = path.join(denoDir, "v8_code_cache_v2");
    if (schema) {
      // Like Deno's: a WAL-mode database, with the npm cache next to it.
      fs.mkdirSync(path.join(denoDir, "npm"), { recursive: true });
      const db = new DatabaseSync(dbPath);
      db.exec("PRAGMA journal_mode = WAL");
      db.exec(schema);
      for (const [specifier, type] of rows.map((r) => r.replace(/^<cwd>/, pathToFileURL(cwd).href).split(" "))) {
        db.prepare("INSERT INTO codecache VALUES (?, ?, ?, ?)").run(specifier, Number(type), 1, Buffer.from("code"));
      }
      db.close();
    }
    const result = spawnSync(
      "bash",
      ["-c", `source "$HELPERS" >/dev/null; safe_remove() { printf '%s\\n' "$1" >> "$REMOVE_LOG"; }; clean_deno_code_cache`],
      {
        encoding: "utf8",
        cwd,
        env: {
          // Only the fake bin dir, this node and sed, so a real deno is never asked.
          PATH: [binDir, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter),
          HOME: path.join(tempDir, "home"),
          HELPERS: path.join(__dirname, "clean-helpers.sh"),
          REMOVE_LOG: removeLog,
          FAKE_DENO_DIR: denoDir,
          ...env,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    let left = null;
    if (fs.existsSync(dbPath) && schema === CODECACHE_SCHEMA) {
      const db = new DatabaseSync(dbPath, { readOnly: true });
      left = db
        .prepare("SELECT specifier, type FROM codecache ORDER BY specifier, type")
        .all()
        .map((r) => `${r.specifier.replace(pathToFileURL(cwd).href, "<cwd>")} ${r.type}`)
        .sort();
      db.close();
    }
    return {
      removed: fs.readFileSync(removeLog, "utf8").trim().split("\n").filter(Boolean),
      left,
      stdout: result.stdout.replaceAll(cwd, "<cwd>"),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(denoDir, { recursive: true, force: true });
  }
};
const tempDenoDir = () => path.join(os.tmpdir(), `deno dir ${process.pid} ${Math.random().toString(36).slice(2)}`);

test("clean_deno_code_cache removes only the entries under the project's .next/", () => {
  const { removed, left, stdout } = runDenoCodeCacheClean({
    denoDir: tempDenoDir(),
    schema: CODECACHE_SCHEMA,
    rows: [
      "<cwd>/.next/server/chunks/961.js 0",
      "<cwd>/.next/server/chunks/961.js 1",
      "<cwd>/.next/server/webpack-runtime.js 1",
      "<cwd>/node_modules/next/dist/build/index.js 1",
      "<cwd>/.next-other/x.js 1",
      "file:///other%20project/.next/server/a.js 1",
    ],
  });
  assert.deepEqual(removed, [], "fell back to removing the whole cache");
  assert.deepEqual(left, [
    "<cwd>/.next-other/x.js 1",
    "<cwd>/node_modules/next/dist/build/index.js 1",
    "file:///other%20project/.next/server/a.js 1",
  ]);
  assert.match(stdout, /removed 3 of 6 entries under <cwd>\/\.next, kept 3/);
});

test("clean_deno_code_cache removes the whole code cache when the schema is not the expected one", () => {
  const denoDir = tempDenoDir();
  const { removed, stdout } = runDenoCodeCacheClean({
    denoDir,
    schema: "CREATE TABLE codecache (key TEXT PRIMARY KEY, data BLOB NOT NULL)",
  });
  // Closing the test database checkpointed its -wal and -shm away; the glob
  // covers them when Deno leaves them behind.
  assert.deepEqual(removed, [path.join(denoDir, "v8_code_cache_v2")]);
  assert.match(stdout, /Warning: couldn't prune Deno's code cache/);
});

test("clean_deno_code_cache does nothing without a code cache", () => {
  assert.deepEqual(runDenoCodeCacheClean({ denoDir: tempDenoDir() }).removed, []);
});

test("clean_deno_code_cache finds the cache through DENO_DIR or XDG_CACHE_HOME when deno isn't on PATH", () => {
  const badSchema = "CREATE TABLE codecache (key TEXT PRIMARY KEY, data BLOB NOT NULL)";
  for (const [denoDir, env] of [
    [tempDenoDir(), (d) => ({ DENO_DIR: d })],
    [path.join(tempDenoDir(), "deno"), (d) => ({ XDG_CACHE_HOME: path.dirname(d) })],
  ]) {
    const { removed } = runDenoCodeCacheClean({ denoDir, denoOnPath: false, schema: badSchema, env: env(denoDir) });
    assert.deepEqual(removed, [path.join(denoDir, "v8_code_cache_v2")]);
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
