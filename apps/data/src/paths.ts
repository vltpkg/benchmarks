/**
 * Filename conventions of the published tree.
 *
 * The tree is frozen (HARD CONSTRAINT 3), so these describe what is already
 * there. Nothing here invents a path.
 */
import { type Fixture, FIXTURES, type Variation } from "@benchmarks/types";

export const CHART_DATA_FILE = "chart-data.json";
export const VERSIONS_FILE = "versions.json";
export const LATEST_DIR = "latest";

/** Names this package publishes at the root of the served tree. */
export const INDEX_FILE = "index.json";
export const MANIFEST_FILE = "manifest.json";

/**
 * Directory holding one shard per published directory.
 *
 * `manifest.json` answers cross-date questions and `index.json` answers "which
 * dates exist", but neither answers "what is in THIS date" without pulling the
 * whole archive. The shards close that hole. Measured over the real tree:
 * index + one shard is 12,093 bytes against 849,397 for index + manifest.
 */
export const MANIFEST_DIR = "manifest";

/**
 * Path of one directory's shard, relative to the tree root.
 *
 * `name` is a `yyyy-mm-dd` date or `latest`. Deliberately a sibling directory
 * rather than a file inside each date directory: decision D2 forbids
 * re-emitting the published date directories, and this keeps every new file in
 * one new subtree.
 */
export const manifestShardPath = (name: string): string[] => [MANIFEST_DIR, `${name}.json`];

/** Directory holding one results summary per date (src/summary.ts), beside the shards. */
export const SUMMARY_DIR = "summary";

export const summaryPath = (date: string): string[] => [SUMMARY_DIR, `${date}.json`];

const PACKAGE_COUNT_SUFFIX = "-package-count.json";
const PROCESS_COUNT_SUFFIX = "-process-count.json";
const JSON_SUFFIX = ".json";

/** What a filename in a date directory refers to. */
export type FileKind = "benchmark" | "package-count" | "process-count";

export interface ParsedDataFile {
  kind: FileKind;
  fixture: Fixture;
  /**
   * The variation, as a plain string rather than {@link Variation}.
   *
   * The published tree can hold variations this checkout's suite does not.
   * `ci+setup` was added upstream on 2026-09-30 and published the same day,
   * while this workspace was on an earlier base. A discovery layer that
   * validated against the union would under-report what is actually there.
   */
  variation: string;
}

const FIXTURE_SET: ReadonlySet<string> = new Set<string>(FIXTURES);

/**
 * Classify a filename from a date directory, or return undefined if it is not
 * one of the three per-fixture kinds.
 *
 * Splitting on the first `-` is safe because no fixture name contains one,
 * while several variations do (`build-cache`, `registry-clean`).
 */
export const parseDataFile = (name: string): ParsedDataFile | undefined => {
  let kind: FileKind;
  let stem: string;

  if (name.endsWith(PACKAGE_COUNT_SUFFIX)) {
    kind = "package-count";
    stem = name.slice(0, -PACKAGE_COUNT_SUFFIX.length);
  } else if (name.endsWith(PROCESS_COUNT_SUFFIX)) {
    kind = "process-count";
    stem = name.slice(0, -PROCESS_COUNT_SUFFIX.length);
  } else if (name.endsWith(JSON_SUFFIX)) {
    kind = "benchmark";
    stem = name.slice(0, -JSON_SUFFIX.length);
  } else {
    return undefined;
  }

  const split = stem.indexOf("-");
  if (split <= 0) return undefined;

  const fixture = stem.slice(0, split);
  const variation = stem.slice(split + 1);
  if (!FIXTURE_SET.has(fixture) || variation.length === 0) return undefined;

  return { kind, fixture: fixture as Fixture, variation };
};

export const benchmarkFile = (fixture: Fixture, variation: Variation | string): string =>
  `${fixture}-${variation}.json`;

export const packageCountFile = (fixture: Fixture, variation: Variation | string): string =>
  `${fixture}-${variation}${PACKAGE_COUNT_SUFFIX}`;

export const processCountFile = (fixture: Fixture, variation: Variation | string): string =>
  `${fixture}-${variation}${PROCESS_COUNT_SUFFIX}`;

/**
 * Join path segments into a URL relative to a base, encoding each segment.
 *
 * Several variations contain `+`. It is legal literally in a path segment, but
 * it is encoded here so the URL is unambiguous for any consumer that treats
 * the value as form-encoded.
 */
export const dataUrl = (baseUrl: string, ...segments: string[]): string => {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return base + segments.map((s) => encodeURIComponent(s)).join("/");
};
