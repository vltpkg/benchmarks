#!/usr/bin/env node
/**
 * Generate index.json and manifest.json for the served tree.
 *
 * Usage:
 *   node bin/build-manifest.mts --out <dir> [<source-dir>...]
 *
 * `--out` is REQUIRED and has no default. A default would point at a fixed
 * directory, and a default pointing at a directory that may not exist is this
 * repository's signature failure: it produces a silent, empty success. A bare
 * invocation must fail loudly instead.
 *
 * Sources are scanned in order and later ones win, so CI layers this run's
 * freshly assembled tree over a checkout of the published history:
 *
 *   node bin/build-manifest.mts --out suite/results gh-pages-data suite/results
 *
 * Writes only index.json, manifest.json, the manifest/ shards and the summary/
 * files. It never
 * copies or re-emits the published date directories (decision D2), and never
 * writes an index.html.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildManifest } from "../src/manifest.ts";
import { scanRoots } from "../src/scan.ts";
import { buildSummary } from "../src/summary.ts";
import { INDEX_FILE, MANIFEST_DIR, MANIFEST_FILE, SUMMARY_DIR } from "../src/paths.ts";
import { isDateKey } from "@benchmarks/types";

const argv = process.argv.slice(2);
let out: string | undefined;
const roots: string[] = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--out") {
    const value = argv[i + 1];
    if (value === undefined) {
      console.error("--out requires a directory");
      process.exit(2);
    }
    out = value;
    i++;
  } else if (arg !== undefined && arg.startsWith("--out=")) {
    out = arg.slice("--out=".length);
  } else if (arg !== undefined) {
    roots.push(arg);
  }
}

if (out === undefined) {
  console.error(
    "--out <dir> is required.\n" +
      "Refusing to guess an output directory: a wrong guess writes an index\n" +
      "describing nothing and exits 0.\n" +
      "  node bin/build-manifest.mts --out suite/results gh-pages-data suite/results",
  );
  process.exit(2);
}

if (roots.length === 0) roots.push(out);

// Same gap as serve.mts had: a source that is named but absent gets skipped by
// scanRoots, and if every source is absent the result is an index describing
// nothing, written successfully, exit 0. A named source must exist.
const missing = roots.filter((r) => {
  try {
    return !statSync(r).isDirectory();
  } catch {
    return true;
  }
});
if (missing.length > 0) {
  console.error(
    `source directories do not exist: ${missing.join(", ")}\n` +
      "Refusing to continue: skipping them would write an index describing\n" +
      "less than the real tree, and exit 0.",
  );
  process.exit(2);
}

const listings = scanRoots(roots);
const { index, manifest } = buildManifest(listings, new Date().toISOString());

// A tree with no dates at all is never a legitimate outcome here; it means the
// sources existed but held nothing recognisable.
if (Object.keys(manifest.entries).length === 0) {
  console.error(
    `no date or latest directories found under: ${roots.join(", ")}\n` +
      "Refusing to write an index that describes nothing.",
  );
  process.exit(2);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`);
writeFileSync(join(out, MANIFEST_FILE), `${JSON.stringify(manifest)}\n`);

// One shard per directory, so a consumer wanting a single date does not pull
// the whole archive. Each shard is exactly manifest.entries[name] -- no
// timestamp, no wrapper -- which keeps unchanged dates byte-identical between
// runs, so the gh-pages deploy records no diff for them.
const shardDir = join(out, MANIFEST_DIR);
mkdirSync(shardDir, { recursive: true });
let shardCount = 0;
for (const [name, entry] of Object.entries(manifest.entries)) {
  if (entry === undefined) continue;
  writeFileSync(join(shardDir, `${name}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  shardCount++;
}

// One results summary per date (src/summary.ts), deterministic for the same
// reason as the shards. latest/ is merged rather than a run, so it gets none.
const summaryDir = join(out, SUMMARY_DIR);
mkdirSync(summaryDir, { recursive: true });
let summaryCount = 0;
const skipped: string[] = [];
for (const listing of listings) {
  if (!isDateKey(listing.name) || listing.dir === undefined) continue;
  const dir = listing.dir;
  const built = buildSummary(listing, (file) => readFileSync(join(dir, file), "utf8"));
  skipped.push(...built.skipped.map((file) => `${listing.name}/${file}`));
  writeFileSync(join(summaryDir, `${listing.name}.json`), `${JSON.stringify(built.summary)}\n`);
  summaryCount++;
}
if (skipped.length > 0) {
  console.warn(`left out of the summaries, not benchmark files: ${skipped.join(", ")}`);
}

const dirCount = Object.keys(manifest.entries).length;
console.log(
  `wrote ${INDEX_FILE}, ${MANIFEST_FILE}, ${shardCount} ${MANIFEST_DIR}/ shards and ` +
    `${summaryCount} ${SUMMARY_DIR}/ files to ${out}: ` +
    `${index.dates.length} dates, ${dirCount} directories, latest=${index.latest ?? "none"}, ` +
    `${index.fixtures.length} fixtures, ${index.variations.length} variations`,
);
