const assert = require("node:assert/strict");
const fs = require("node:fs");

try {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.ok([2, 3].includes(lock.lockfileVersion), "expected npm lockfile v2/v3");
  assert.ok(lock.packages && !Array.isArray(lock.packages), "missing packages");
  const root = lock.packages[""];
  assert.ok(root && typeof root === "object", "missing root package");
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    assert.deepEqual(root[field] || {}, manifest[field] || {}, `${field} differ from package.json`);
  }
  for (const [location, pkg] of Object.entries(lock.packages)) {
    assert.ok(pkg && typeof pkg === "object", `invalid package: ${location}`);
    if (location.includes("node_modules/") && !pkg.link) {
      assert.equal(typeof pkg.version, "string", `missing version: ${location}`);
      assert.equal(typeof pkg.resolved, "string", `missing resolved URL: ${location}`);
    }
  }
} catch (error) {
  console.error(`Invalid registry warmup package-lock.json: ${error.message}`);
  process.exitCode = 1;
}
