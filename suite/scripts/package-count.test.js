const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { countPackages } = require("./package-count.js");

test("counts hoisted and nested packages, including dotted names", (t) => {
  const dir = project(t, {
    "package.json": { dependencies: { a: "1" }, devDependencies: { "lodash.merge": "1" } },
    "node_modules/a/package.json": { dependencies: { b: "1", "@x.y/c": "1" } },
    "node_modules/a/node_modules/b/package.json": {},
    "node_modules/b/package.json": {},
    "node_modules/@x.y/c/package.json": {},
    "node_modules/lodash.merge/package.json": {},
  });
  // the hoisted b is never reached: a uses its nested copy
  assert.equal(countPackages(dir), 4);
});

test("skips packages left in store folders after a remove", (t) => {
  const dir = project(t, {
    "package.json": { dependencies: { a: "1" } },
    "node_modules/.aube/a@1/node_modules/a/package.json": { dependencies: { b: "1" } },
    "node_modules/.aube/b@1/node_modules/b/package.json": {},
    "node_modules/.aube/removed@1/node_modules/removed/package.json": {},
    "node_modules/.upm/removed@1/node_modules/removed/package.json": {},
    "node_modules/.vlt/.VLT.DELETE.1.removed@1/node_modules/removed/package.json": {},
  });
  link(dir, "node_modules/a", "node_modules/.aube/a@1/node_modules/a");
  link(dir, "node_modules/.aube/a@1/node_modules/b", "node_modules/.aube/b@1/node_modules/b");
  assert.equal(countPackages(dir), 2);
});

test("follows symlinks into a store outside the project", (t) => {
  const store = project(t, {
    "a@1/node_modules/a/package.json": { dependencies: { b: "1" } },
    "b@1/node_modules/b/package.json": {},
  });
  link(store, "a@1/node_modules/b", "b@1/node_modules/b");
  const dir = project(t, { "package.json": { dependencies: { a: "1" } } });
  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.symlinkSync(path.join(store, "a@1/node_modules/a"), path.join(dir, "node_modules/a"));
  assert.equal(countPackages(dir), 2);
});

test("walks workspaces without counting them", (t) => {
  const dir = project(t, {
    "package.json": { workspaces: ["packages/*", "!packages/excluded"] },
    "packages/excluded/package.json": { dependencies: { c: "1" } },
    "node_modules/c/package.json": {},
    "pnpm-workspace.yaml": "packages:\n  - 'tools/*'\n",
    "packages/one/package.json": { dependencies: { a: "1", two: "workspace:*" } },
    "packages/one/node_modules/a/package.json": {},
    "packages/two/package.json": { devDependencies: { b: "1" } },
    "tools/three/package.json": { dependencies: { b: "1" } },
    "node_modules/b/package.json": {},
  });
  link(dir, "packages/one/node_modules/two", "packages/two");
  assert.equal(countPackages(dir), 2);
});

function project(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "package-count-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(
      path.join(dir, file),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }
  return dir;
}

function link(dir, from, to) {
  fs.mkdirSync(path.dirname(path.join(dir, from)), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(path.join(dir, from)), path.join(dir, to)), path.join(dir, from));
}
