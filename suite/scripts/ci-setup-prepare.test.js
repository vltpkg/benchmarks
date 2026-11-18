const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

// Runs variations/ci+setup.sh with every tool, hyperfine and strace stubbed
// (each stub logs its arguments; `bun install` writes a lockfile and a
// node_modules). The hyperfine stub records its argv, so the test can read
// each tool's --prepare and run one by hand. Nothing touches the real home,
// /tmp or the caches: HOME, BENCH_SETUP_TMP and the fixture are temporary
// directories and XDG_* / npm_config_* are not passed on.
const PMS = ["npm", "yarn", "berry", "zpm", "pnpm", "vlt", "bun", "deno", "aube", "upm"];
const STUBS = [...PMS, "nx", "vp", "corepack", "curl", "strace"];

function setup(t, { include, hyperfineExit = 0 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-setup-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, "bin");
  const home = path.join(dir, "home");
  const tmp = path.join(dir, "tmp");
  const fixture = path.join(dir, "fixtures", "next");
  const results = path.join(dir, "results");
  const commandLog = path.join(dir, "commands.txt");
  const argvFile = path.join(dir, "hyperfine-argv.json");
  for (const d of [bin, home, tmp, fixture]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(fixture, "package.json"), '{"name":"next","version":"1.0.0"}\n');
  fs.writeFileSync(commandLog, "");
  for (const name of STUBS) {
    fs.writeFileSync(
      path.join(bin, name),
      `#!/bin/sh
printf '%s %s\\n' "$(basename "$0")" "$*" >> "$COMMAND_LOG"
if [ "$(basename "$0")" = bun ] && [ "$1" = install ]; then
  [ "$BUN_FAIL" = 1 ] && exit 1
  printf 'lockfile for %s\\n' "$(pwd)" > bun.lock
  mkdir -p node_modules/a && printf '{"name":"a","version":"1.0.0"}' > node_modules/a/package.json
fi
exit 0
`,
      { mode: 0o755 },
    );
  }
  fs.writeFileSync(
    path.join(bin, "hyperfine"),
    `#!/usr/bin/env node
require("node:fs").writeFileSync(process.env.HYPERFINE_ARGV, JSON.stringify(process.argv.slice(2)));
process.exit(${hyperfineExit});
`,
    { mode: 0o755 },
  );
  const env = {
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    HOME: home,
    LANG: "C.UTF-8",
    BENCH_SETUP_TMP: tmp,
    BENCH_BERRY_VERSION: "4.9.2",
    BENCH_ZPM_VERSION: "6.0.0-rc.20",
    BENCH_INCLUDE: include,
    BENCH_WARMUP: "1",
    BENCH_RUNS: "1",
    COMMAND_LOG: commandLog,
    HYPERFINE_ARGV: argvFile,
  };
  const scripts = path.resolve(__dirname);
  const run = () =>
    spawnSync("bash", [path.join(scripts, "variations", "ci+setup.sh"), scripts, path.join(dir, "results"), "next", "ci+setup"], {
      cwd: fixture,
      encoding: "utf8",
      env,
    });
  const commands = () => fs.readFileSync(commandLog, "utf8").trim().split("\n").filter(Boolean);
  const argv = () => JSON.parse(fs.readFileSync(argvFile, "utf8"));
  // the --prepare that precedes --command-name=<pm>
  const prepareOf = (pm) => {
    const a = argv();
    const i = a.indexOf(`--command-name=${pm}`);
    assert.ok(i > 0, `no command named ${pm}`);
    assert.match(a[i - 1], /^--prepare=/);
    return a[i - 1].slice("--prepare=".length);
  };
  const marker = (pm) => path.join(results, "next", "ci+setup", `.ci-setup-ready-${pm}`);
  return { dir, fixture, results, env, run, commands, argv, prepareOf, marker, commandLog };
}

test("ci+setup: every tool's prepare installs the lockfile once, and uninstalls the PM every time", (t) => {
  const s = setup(t, { include: PMS.join(","), hyperfineExit: 1 });
  const r = s.run();
  assert.notEqual(r.status, 0, "the hyperfine stub fails, so the script stops there");
  for (const pm of PMS) {
    const prepare = s.prepareOf(pm);
    const guard = `if [ ! -e ${s.marker(pm)} ]; then `;
    const i = prepare.indexOf(guard);
    assert.ok(i >= 0, `${pm}: prepare has no once-per-tool guard: ${prepare}`);
    const once = prepare.slice(i + guard.length, prepare.indexOf("; fi", i));
    const after = prepare.slice(prepare.indexOf("; fi", i) + 4);
    // once: clean the previous tool's state, install the PM, write the lockfile
    assert.match(once, /clean_node_modules clean_lockfiles clean_package_manager_files clean_package_manager_field/, pm);
    assert.match(once, / install /, `${pm}: no install in the once part`);
    assert.match(once, new RegExp(`&& touch ${s.marker(pm).replace(/[+.]/g, "\\$&")} \\|\\| true`), pm);
    // every run: clean node_modules, uninstall the PM, nothing that touches the lockfile
    assert.match(after, /clean_node_modules clean_package_manager_files/, pm);
    assert.doesNotMatch(after, /clean_lockfiles|clean_package_manager_field| install /, `${pm}: ${after}`);
    assert.match(after, /rm -rf|uninstall -g/, `${pm}: no uninstall after the guard`);
  }
  // berry: corepack's home is purged every run, after the guard
  assert.match(s.prepareOf("berry").split("; fi")[1], /rm -rf .*bench-corepack-home/);
  // --conclude keeps the lockfile and the packageManager pin for the next run
  const conclude = s.argv().find((a) => a.startsWith("--conclude="));
  assert.match(conclude, /package-count\.sh/);
  assert.match(conclude, /clean_node_modules/);
  assert.doesNotMatch(conclude, /clean_lockfiles|clean_package_manager_field/);
  // --cleanup still resets everything between tools
  assert.match(s.argv().find((a) => a.startsWith("--cleanup=")), /clean_all/);
});

test("ci+setup: the second prepare of a tool keeps the lockfile and only uninstalls the PM", (t) => {
  const s = setup(t, { include: "bun" });
  const r = s.run();
  assert.equal(r.status, 0, r.stderr);
  const prepare = s.prepareOf("bun");
  const runPrepare = (extra = {}) => {
    const p = spawnSync("sh", ["-c", prepare], { cwd: s.fixture, encoding: "utf8", env: { ...s.env, ...extra } });
    assert.equal(p.status, 0, p.stderr);
  };
  const count = (re) => s.commands().filter((c) => re.test(c)).length;
  const lockfile = () => fs.existsSync(path.join(s.fixture, "bun.lock")) && fs.readFileSync(path.join(s.fixture, "bun.lock"), "utf8");

  // the script's own process-count pass already ran bun's prepare once (see below)
  fs.writeFileSync(s.commandLog, "");
  fs.rmSync(s.marker("bun"), { force: true });

  // a failed lockfile install leaves no marker, so the next prepare retries
  runPrepare({ BUN_FAIL: "1" });
  assert.equal(fs.existsSync(s.marker("bun")), false);
  assert.equal(lockfile(), false);
  assert.equal(count(/^npm install -g .*bun@latest$/), 1);
  assert.equal(count(/^npm uninstall -g bun$/), 1);

  // first successful prepare: PM installed, lockfile written, then PM removed
  runPrepare();
  assert.equal(fs.existsSync(s.marker("bun")), true);
  assert.equal(lockfile(), `lockfile for ${s.fixture}\n`);
  assert.equal(fs.existsSync(path.join(s.fixture, "node_modules")), false);
  assert.equal(count(/^npm install -g .*bun@latest$/), 2);
  assert.equal(count(/^bun install --ignore-scripts --silent$/), 2);
  assert.equal(count(/^npm uninstall -g bun$/), 2);

  // what a timed run leaves behind
  fs.mkdirSync(path.join(s.fixture, "node_modules/b"), { recursive: true });

  // second prepare: no install, lockfile untouched, node_modules and the PM gone
  runPrepare();
  assert.equal(lockfile(), `lockfile for ${s.fixture}\n`);
  assert.equal(fs.existsSync(path.join(s.fixture, "node_modules")), false);
  assert.equal(count(/^npm install -g .*bun@latest$/), 2);
  assert.equal(count(/^bun install --ignore-scripts --silent$/), 2);
  assert.equal(count(/^npm uninstall -g bun$/), 3);
});

test("ci+setup: the process-count pass drops the marker so its prepare writes the lockfile again", (t) => {
  const s = setup(t, { include: "bun" });
  const r = s.run();
  assert.equal(r.status, 0, r.stderr);
  // hyperfine is a stub, so the only prepare that ran is process-count.sh's:
  // a full first prepare, strace'd install, then clean_all
  const commands = s.commands();
  assert.deepEqual(
    commands.filter((c) => /^(npm (un)?install|bun install)/.test(c)),
    [
      "npm install -g --cache " + path.join(s.dir, "tmp", "bench-tool-setup-cache") + " --allow-scripts=bun bun@latest",
      "bun install --ignore-scripts --silent",
      "npm uninstall -g bun",
    ],
  );
  assert.ok(commands.some((c) => c.startsWith("strace ")), "the counted install ran under strace");
  assert.equal(fs.existsSync(s.marker("bun")), true);
  assert.equal(fs.existsSync(path.join(s.fixture, "bun.lock")), false, "clean_all ran last");
});
