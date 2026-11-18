#!/usr/bin/env node
// Remove the entries for one project's `.next/` output from Deno's compiled-code
// cache, and keep everything else (next's own files in node_modules never go
// stale). Called by clean_deno_code_cache in clean-helpers.sh:
//
//   node deno-code-cache.js <path to v8_code_cache_v2> <project dir>
//
// The cache is a SQLite database in WAL mode with one table,
//   codecache (specifier TEXT, type INTEGER, source_hash INTEGER, data BLOB,
//              PRIMARY KEY (specifier, type))
// where specifier is the module's file:// URL. Prints what it removed. Exits 1,
// with the reason on stderr, when the database isn't shaped like that, so the
// caller can fall back to removing the whole cache.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const EXPECTED_COLUMNS = ["specifier", "type", "source_hash", "data"];

const main = (dbPath, projectDir) => {
  if (!dbPath || !projectDir) {
    throw new Error("usage: deno-code-cache.js <v8_code_cache_v2> <project dir>");
  }
  if (!fs.existsSync(dbPath)) {
    return;
  }
  const db = new DatabaseSync(dbPath);
  try {
    const columns = db
      .prepare("SELECT name FROM pragma_table_info('codecache')")
      .all()
      .map((row) => row.name);
    if (columns.join() !== EXPECTED_COLUMNS.join()) {
      throw new Error(`unexpected codecache columns: ${JSON.stringify(columns)}`);
    }
    const total = db.prepare("SELECT count(*) AS n FROM codecache").get().n;
    let removed = 0;
    const remove = db.prepare("DELETE FROM codecache WHERE specifier LIKE ? ESCAPE '\\'");
    for (const prefix of nextOutputUrls(projectDir)) {
      removed += remove.run(`${prefix.replace(/[\\%_]/g, "\\$&")}%`).changes;
    }
    console.log(
      `deno code cache: removed ${removed} of ${total} entries under ${path.join(projectDir, ".next")}, kept ${total - removed}`,
    );
  } finally {
    db.close();
  }
};

// file:// URL prefixes of the project's .next/ directory: as given and with
// symlinks resolved, since Deno records the path it loaded the file from.
const nextOutputUrls = (projectDir) => {
  const dirs = new Set([path.resolve(projectDir)]);
  try {
    dirs.add(fs.realpathSync(projectDir));
  } catch {}
  return [...dirs].map((dir) => `${pathToFileURL(path.join(dir, ".next")).href}/`);
};

try {
  main(process.argv[2], process.argv[3]);
} catch (err) {
  console.error(`deno-code-cache.js: ${err.message}`);
  process.exit(1);
}
