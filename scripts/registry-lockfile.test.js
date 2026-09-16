const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const run = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, options);
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  child.on("error", reject);
  child.on("close", status => resolve({ status, output }));
});

function fixture(t, { realNpm = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-lockfile-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const scripts = path.join(dir, "scripts");
  const output = path.join(dir, "results");
  fs.mkdirSync(scripts);
  fs.mkdirSync(output);
  for (const file of ["registry-package-count.sh", "collect-package-count.js"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(scripts, file));
  }
  // Isolate destructive benchmark cleanup to this test's fixture/cache.
  fs.writeFileSync(path.join(scripts, "clean-helpers.sh"), `set -eu
for action in "$@"; do
  case "$action" in
    clean_all) rm -rf node_modules package-lock.json .npmrc .npm-cache ;;
    clean_node_modules) rm -rf node_modules ;;
    clean_all_cache) rm -rf .npm-cache ;;
    clean_npmrc) rm -f .npmrc ;;
  esac
done
`);
  fs.cpSync(path.join(__dirname, "registry"), path.join(scripts, "registry"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }));
  const validLock = path.join(dir, "valid-lock.json");
  fs.writeFileSync(validLock, JSON.stringify({ lockfileVersion: 3, packages: { "": { name: "fixture", version: "1.0.0" } } }));
  const env = {
    ...process.env,
    GITHUB_STEP_SUMMARY: path.join(dir, "summary.md"),
    npm_config_cache: path.join(dir, ".npm-cache"),
    npm_config_userconfig: path.join(dir, "user.npmrc"),
  };
  if (!realNpm) {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "npm"), `#!/bin/sh
if [ "$1" = install ]; then
  if [ -f package-lock.json ]; then printf 'existing ' >> installs; else printf 'fresh ' >> installs; fi
  cat .npmrc >> installs
  cp "${validLock}" package-lock.json
  mkdir -p node_modules/example
  printf '{"name":"example"}' > node_modules/example/package.json
elif [ "$2" = set ]; then
  if [ "$3" = registry ]; then printf '%s\\n' "$4" > .npmrc; fi
else
  cat .npmrc
fi
`, { mode: 0o755 });
    env.PATH = `${bin}:${env.PATH}`;
  }
  return {
    dir, scripts, output, env, validLock,
    async benchmark({ install = `cp ${quote(validLock)} package-lock.json`, timeout = "2", warmups = "1", conclude, registry = "http://127.0.0.1/", command = "echo timed >> timed-runs" } = {}) {
      const setup = `npm config set registry ${quote(registry)} --location=project`;
      const prepare = ["bash", path.join(scripts, "registry/prepare-lockfile.sh"), scripts, output, "npm", registry, setup, install, warmups, timeout].map(quote).join(" ");
      const args = ["--ignore-failure", "--warmup=0", "--runs=2", `--export-json=${output}/benchmarks.json`, `--prepare=${prepare}`];
      if (conclude) args.push(`--conclude=${conclude}`);
      args.push(command);
      return run("hyperfine", args, { cwd: dir, env });
    },
  };
}

for (const scenario of [
  { name: "timeout", install: "sleep 1", timeout: "0.05", pattern: /timeout 0.05s.*exit 124/ },
  { name: "nonzero exit", install: "exit 23", pattern: /exit 23/ },
  { name: "missing lockfile", install: "true", pattern: /lockfile validation/ },
  { name: "malformed lockfile", install: "echo '{' > package-lock.json", pattern: /lockfile validation/ },
  { name: "invalid lockfile", install: "echo '{}' > package-lock.json", pattern: /lockfile validation/ },
]) {
  test(`failed ${scenario.name} warmup stops timing and reports in the job summary`, async t => {
    const f = fixture(t);
    // A stale lockfile must not make a failed warmup look successful.
    fs.copyFileSync(f.validLock, path.join(f.dir, "package-lock.json"));
    const result = await f.benchmark(scenario);
    assert.notEqual(result.status, 0, result.output);
    assert.equal(fs.existsSync(path.join(f.dir, "timed-runs")), false);
    assert.match(fs.readFileSync(f.env.GITHUB_STEP_SUMMARY, "utf8"), scenario.pattern);
    assert.equal(fs.existsSync(path.join(f.output, "npm-package-lock.json")), false);
  });
}

test("successful slow warmup has its own timeout and both timed runs start with its lockfile", async t => {
  const f = fixture(t);
  const result = await f.benchmark({
    install: `sleep 0.2; cp ${quote(f.validLock)} package-lock.json`,
    timeout: "1",
    command: "timeout 0.05 sh -c 'test -s package-lock.json && echo timed >> timed-runs'",
  });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(f.dir, "timed-runs"), "utf8"), "timed\ntimed\n");
  assert.match(fs.readFileSync(f.env.GITHUB_STEP_SUMMARY, "utf8"), /warmup\(s\) succeeded/);
});

test("BENCH_WARMUP=0 still creates a required fresh lockfile", async t => {
  const f = fixture(t);
  const result = await f.benchmark({ warmups: "0" });
  assert.equal(result.status, 0, result.output);
  assert.equal(fs.existsSync(path.join(f.output, "npm-warmup-0.log")), true);
});

test("a failed later warmup cannot reuse the first warmup's valid lockfile", async t => {
  const f = fixture(t);
  const result = await f.benchmark({
    warmups: "2",
    install: `if [ -f warmed ]; then exit 24; fi; touch warmed; cp ${quote(f.validLock)} package-lock.json`,
  });
  assert.notEqual(result.status, 0, result.output);
  assert.equal(fs.existsSync(path.join(f.dir, "timed-runs")), false);
  assert.match(fs.readFileSync(f.env.GITHUB_STEP_SUMMARY, "utf8"), /warmup 1.*exit 24/);
});

test("a replaced lockfile stops the next timed run", async t => {
  const f = fixture(t);
  const result = await f.benchmark({ conclude: "echo '{}' > package-lock.json" });
  assert.notEqual(result.status, 0, result.output);
  assert.equal(fs.readFileSync(path.join(f.dir, "timed-runs"), "utf8"), "timed\n");
  assert.match(fs.readFileSync(f.env.GITHUB_STEP_SUMMARY, "utf8"), /timed-run lockfile validation/);
});

test("real npm timed installs fetch tarballs and no packuments after warmup", async t => {
  const f = fixture(t, { realNpm: true });
  const tarDir = path.join(f.dir, "tar");
  fs.mkdirSync(path.join(tarDir, "package"), { recursive: true });
  fs.writeFileSync(path.join(tarDir, "package/package.json"), JSON.stringify({ name: "test-package", version: "1.0.0" }));
  const tarball = path.join(f.dir, "test-package.tgz");
  const packed = spawnSync("tar", ["-czf", tarball, "-C", tarDir, "package"], { encoding: "utf8" });
  assert.equal(packed.status, 0, packed.stderr);
  const bytes = fs.readFileSync(tarball);
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, timed: fs.existsSync(path.join(f.dir, "timing")) });
    if (req.url === "/test-package") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ name: "test-package", "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": { name: "test-package", version: "1.0.0", dist: { tarball: `${registry}test-package/-/test-package-1.0.0.tgz` } } } }));
    } else if (req.url === "/test-package/-/test-package-1.0.0.tgz") {
      res.setHeader("content-type", "application/octet-stream");
      res.end(bytes);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const registry = `http://127.0.0.1:${server.address().port}/`;
  fs.writeFileSync(path.join(f.dir, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", dependencies: { "test-package": "^1.0.0" } }));
  const install = "npm install --prefer-online --no-audit --no-fund --no-update-notifier --ignore-scripts --loglevel=http";
  const result = await f.benchmark({ registry, install, timeout: "20", command: `touch timing; timeout 20 ${install}; status=$?; rm timing; exit $status` });
  assert.equal(result.status, 0, result.output);
  assert.ok(requests.some(req => !req.timed && req.url === "/test-package"));
  const timed = requests.filter(req => req.timed);
  assert.equal(timed.length, 2, JSON.stringify(requests));
  assert.ok(timed.every(req => req.url.endsWith(".tgz")), JSON.stringify(timed));
  const results = JSON.parse(fs.readFileSync(path.join(f.output, "benchmarks.json")));
  assert.deepEqual(results.results[0].exit_codes, [0, 0]);
});


test("the full variation creates a separate fresh warmup for each registry", async t => {
  const f = fixture(t);
  const result = await run("bash", [path.join(__dirname, "variations/registry-lockfile.sh"), f.scripts, f.output, "fixture", "registry-lockfile"], {
    cwd: f.dir,
    env: { ...f.env, BENCH_INCLUDE_REGISTRY: "npm,vlt", BENCH_WARMUP: "1", BENCH_RUNS: "2", VLT_TOKEN: "test", CLOUDSMITH_REGISTRY: "", GH_REGISTRY: "", JFROG_REGISTRY: "" },
  });
  assert.equal(result.status, 0, result.output);
  const installs = fs.readFileSync(path.join(f.dir, "installs"), "utf8").trim().split("\n");
  assert.deepEqual(installs, [
    "fresh https://registry.npmjs.org/",
    "existing https://registry.npmjs.org/",
    "existing https://registry.npmjs.org/",
    "fresh https://registry.vlt.io/vlt-benchmarks/npm/",
    "existing https://registry.vlt.io/vlt-benchmarks/npm/",
    "existing https://registry.vlt.io/vlt-benchmarks/npm/",
  ]);
  const results = JSON.parse(fs.readFileSync(path.join(f.output, "fixture/registry-lockfile/benchmarks.json")));
  assert.deepEqual(results.results.map(row => [row.command, row.exit_codes]), [["npm", [0, 0]], ["vlt", [0, 0]]]);
});
