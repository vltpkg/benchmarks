/**
 * The generated index and manifest.
 *
 * Both are built from what each directory ACTUALLY contains. That is not
 * pedantry: `chart-data.json` has six distinct shapes across the 352 published
 * date directories and five of its seven top-level fields are optional, so an
 * index derived from an assumed schema would misreport most of the archive.
 * See packages/types for the survey.
 */
import { isDateKey } from "@benchmarks/types";
import { CHART_DATA_FILE, LATEST_DIR, parseDataFile, VERSIONS_FILE } from "./paths.ts";

export const INDEX_VERSION = 1;

/** Fixture name to the variations present for it, sorted. */
export type VariationsByFixture = { [fixture: string]: string[] | undefined };

/** What one directory of the published tree contains. */
export interface DirectoryEntry {
  /** `yyyy-mm-dd`, or `latest`. */
  name: string;
  /** True for `latest`, which is merged rather than replaced and is not a date. */
  isLatest: boolean;
  /** Total files seen in the directory, including ones not classified below. */
  fileCount: number;
  benchmarks: VariationsByFixture;
  packageCounts: VariationsByFixture;
  processCounts: VariationsByFixture;
  hasChartData: boolean;
  /** `latest/` carries no `versions.json`, so this is genuinely per-directory. */
  hasVersions: boolean;
}

/**
 * The light index, published at the root of the served tree.
 *
 * Deliberately small: navigation only. Pair-level detail lives in the
 * manifest so a consumer that only needs "which dates exist" does not pay for
 * the whole archive.
 */
export interface DataIndex {
  version: number;
  generatedAt: string;
  /** Newest date directory, or null when the tree has none. */
  latest: string | null;
  /** True when a `latest/` directory is present alongside the dates. */
  hasLatestDir: boolean;
  /** Date directory names, oldest first. */
  dates: string[];
  /** Every fixture observed anywhere in the tree, sorted. */
  fixtures: string[];
  /** Every variation observed anywhere in the tree, sorted. */
  variations: string[];
}

/** The full detail, published alongside the index. */
export interface DataManifest {
  version: number;
  generatedAt: string;
  latest: string | null;
  /** Keyed by directory name, so `latest` sits beside the dates. */
  entries: { [name: string]: DirectoryEntry | undefined };
}

/** One directory's raw listing, as a scanner produces it. */
export interface DirectoryListing {
  name: string;
  files: string[];
  /** Where the directory is on disk, when it was scanned from one. */
  dir?: string;
}

const addPair = (into: VariationsByFixture, fixture: string, variation: string): void => {
  const list = into[fixture];
  if (list === undefined) into[fixture] = [variation];
  else if (!list.includes(variation)) list.push(variation);
};

const sortLists = (byFixture: VariationsByFixture): void => {
  for (const list of Object.values(byFixture)) list?.sort();
};

/** Classify one directory listing. Pure -- no filesystem, no network. */
export const buildDirectoryEntry = (listing: DirectoryListing): DirectoryEntry => {
  const entry: DirectoryEntry = {
    name: listing.name,
    isLatest: listing.name === LATEST_DIR,
    fileCount: listing.files.length,
    benchmarks: {},
    packageCounts: {},
    processCounts: {},
    hasChartData: listing.files.includes(CHART_DATA_FILE),
    hasVersions: listing.files.includes(VERSIONS_FILE),
  };

  for (const file of listing.files) {
    if (file === CHART_DATA_FILE || file === VERSIONS_FILE) continue;
    const parsed = parseDataFile(file);
    if (parsed === undefined) continue;
    const target =
      parsed.kind === "benchmark"
        ? entry.benchmarks
        : parsed.kind === "package-count"
          ? entry.packageCounts
          : entry.processCounts;
    addPair(target, parsed.fixture, parsed.variation);
  }

  sortLists(entry.benchmarks);
  sortLists(entry.packageCounts);
  sortLists(entry.processCounts);
  return entry;
};

/**
 * Build the index and manifest from directory listings.
 *
 * Listings that are neither a `yyyy-mm-dd` date nor `latest` are ignored. That
 * matters: the publish root also holds `assets/`, `data/`, `old/`, `raw/` and
 * the raw `results-<fixture>-<variation>/` directories every deploy publishes
 * alongside the processed data (roughly 85 of them).
 */
export const buildManifest = (
  listings: DirectoryListing[],
  generatedAt: string,
): { index: DataIndex; manifest: DataManifest } => {
  const entries: { [name: string]: DirectoryEntry | undefined } = {};
  const dates: string[] = [];
  const fixtures = new Set<string>();
  const variations = new Set<string>();
  let hasLatestDir = false;

  for (const listing of listings) {
    const isDate = isDateKey(listing.name);
    const isLatest = listing.name === LATEST_DIR;
    if (!isDate && !isLatest) continue;

    const entry = buildDirectoryEntry(listing);
    entries[listing.name] = entry;
    if (isDate) dates.push(listing.name);
    if (isLatest) hasLatestDir = true;

    for (const byFixture of [entry.benchmarks, entry.packageCounts, entry.processCounts]) {
      for (const [fixture, list] of Object.entries(byFixture)) {
        fixtures.add(fixture);
        for (const variation of list ?? []) variations.add(variation);
      }
    }
  }

  dates.sort();
  const latest = dates.at(-1) ?? null;

  return {
    index: {
      version: INDEX_VERSION,
      generatedAt,
      latest,
      hasLatestDir,
      dates,
      fixtures: [...fixtures].sort(),
      variations: [...variations].sort(),
    },
    manifest: { version: INDEX_VERSION, generatedAt, latest, entries },
  };
};
