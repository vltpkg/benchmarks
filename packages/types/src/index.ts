/**
 * Types for the benchmark data published to the `gh-pages` branch.
 *
 * These are **descriptive**, not prescriptive. The published tree is a frozen
 * contract (352 date directories, 2025-08-22 through 2026-09-30 at the time of
 * writing) and every shape here was derived by surveying that tree, not from
 * documentation. Where the survey found a field to be absent in some
 * directories, it is optional here -- even when current runs always emit it.
 *
 * Changing a type in this file to be stricter than the data will break
 * consumers on historical directories. If a field looks like it should be
 * required, check the oldest directories first.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** Benchmark fixtures. Matches `suite/bench list`. */
export type Fixture = "astro" | "babylon" | "large" | "next" | "run" | "svelte" | "vue";

export const FIXTURES = [
  "astro",
  "babylon",
  "large",
  "next",
  "run",
  "svelte",
  "vue",
] as const satisfies readonly Fixture[];

/**
 * Benchmark variations **the suite currently runs**. Several contain `+`, which
 * is legal in a filename but must be encoded when used in a URL path segment.
 *
 * This is deliberately NOT a validator for the published tree, which can hold
 * variations this list does not. The set drifts in both directions and the
 * published tree is the side that moves first.
 *
 * Example: `ci+setup` was added upstream on 2026-09-30 and the nightly
 * published 18 files for it that same day, while this workspace was still on a
 * base that predated it, so for a while the published tree was AHEAD of this
 * list by one variation. It is absent from all 351 earlier date directories.
 *
 * Code reading the published tree must therefore treat a variation as an
 * opaque string and discover the set from the data, the way `apps/data` does.
 * Use {@link isVariation} to ask "does this checkout's suite run this", never
 * "is this a real entry in the tree".
 */
export type Variation =
  | "build"
  | "build-cache"
  | "cache"
  | "cache+lockfile"
  | "cache+lockfile+node_modules"
  | "cache+node_modules"
  | "ci"
  | "ci+setup"
  | "clean"
  | "lockfile"
  | "lockfile+node_modules"
  | "node_modules"
  | "registry-clean"
  | "registry-lockfile"
  | "run";

export const VARIATIONS = [
  "build",
  "build-cache",
  "cache",
  "cache+lockfile",
  "cache+lockfile+node_modules",
  "cache+node_modules",
  "ci",
  "ci+setup",
  "clean",
  "lockfile",
  "lockfile+node_modules",
  "node_modules",
  "registry-clean",
  "registry-lockfile",
  "run",
] as const satisfies readonly Variation[];

/** Variations that compare registries rather than package managers. */
export type RegistryVariation = Extract<Variation, `registry-${string}`>;

/**
 * A `yyyy-mm-dd` directory name.
 *
 * The template literal catches obvious mistakes on literals while still
 * accepting strings built at runtime. Use {@link isDateKey} to validate a
 * value that came from outside the program.
 */
export type DateKey = `${number}-${number}-${number}`;

/** Matches the `yyyy-mm-dd` directory names, including a real calendar check. */
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Series names appearing in per-package-manager data. Observed across the
 * published tree; the set has grown over time, so treat it as the names seen
 * so far rather than a closed set.
 */
export type PackageManager =
  | "aube"
  | "berry"
  | "bun"
  | "deno"
  | "node"
  | "npm"
  | "nx"
  | "pacquet"
  | "pnpm"
  | "pnpm11"
  | "turbo"
  | "upm"
  | "vlt"
  | "vp"
  | "yarn"
  | "zpm";

/** Series names appearing in `registry-*` data. */
export type RegistryName = "aws" | "cloudsmith" | "github" | "jfrog" | "npm" | "vlt";

/** Either kind of series name. */
export type SeriesName = PackageManager | RegistryName;

// ---------------------------------------------------------------------------
// /{date}/{fixture}-{variation}.json  -- hyperfine output
// ---------------------------------------------------------------------------

/**
 * One measured command within a benchmark file.
 *
 * All ten fields are present in every result object in the published archive:
 * one field signature across 151,800 result objects spanning all 352 date
 * directories, zero exceptions (exhaustively re-checked in review).
 *
 * `mean`, `stddev`, `median`, `min`, `max`, `user` and `system` are seconds;
 * JSON sometimes encodes them as integers, which is still `number`.
 */
export interface BenchmarkResult {
  /** The package manager or registry being measured, e.g. `npm`. */
  command: string;
  mean: number;
  stddev: number;
  median: number;
  min: number;
  max: number;
  user: number;
  system: number;
  /** One entry per hyperfine run. */
  times: number[];
  /** One entry per hyperfine run, parallel to {@link times}. */
  exit_codes: number[];
}

/** `/{date}/{fixture}-{variation}.json`. The only top-level key is `results`. */
export interface BenchmarkFile {
  results: BenchmarkResult[];
}

// ---------------------------------------------------------------------------
// /{date}/{fixture}-{variation}-package-count.json
// /{date}/{fixture}-{variation}-process-count.json
// ---------------------------------------------------------------------------

/**
 * A package-count entry.
 *
 * `minCount`/`maxCount` appear only where a variation produced a range, so
 * they are optional. They are not limited to `registry-*` variations.
 */
export interface PackageCountEntry {
  count: number;
  minCount?: number;
  maxCount?: number;
}

/** A process-count entry. Only ever `{ count }` in the surveyed tree. */
export interface ProcessCountEntry {
  count: number;
}

/**
 * `/{date}/{fixture}-{variation}-package-count.json`.
 *
 * Keyed by package manager for ordinary variations and by **registry name**
 * for `registry-*` variations. An index signature rather than a closed record
 * because the key set has grown over time; lookups are therefore possibly
 * `undefined`.
 *
 * Also optional per (date, fixture, variation) -- see {@link ProcessCount} for
 * the two independent reasons a sibling can be absent.
 */
export type PackageCount = { [series: string]: PackageCountEntry | undefined };

/**
 * `/{date}/{fixture}-{variation}-process-count.json`.
 *
 * **Never infer that this file exists.** Both sibling files are independently
 * optional per (date, fixture, variation), and they are missing for two
 * unrelated reasons:
 *
 * 1. `registry-*` variations emit **no process-count at all**, ever. Verified
 *    exhaustively: zero registry process-count files across all 352 date
 *    directories. They do publish a package-count, but only from 2026-03-31
 *    onward -- the same date `registryPerPackageCountChartData` first
 *    appears, so both arrived in one upstream change. Precisely: on and
 *    after that date every registry benchmark that EXISTS has a
 *    package-count. That is not the same as every date having one, because
 *    some dates run no registry variations at all -- 2026-04-14 has zero
 *    registry benchmarks.
 * 2. `build`, `build-cache` and `run` emit **neither** sibling, because they
 *    measure a script rather than an install. This is a property of the
 *    variation, not of a particular run: across all 352 date directories,
 *    none of their benchmark files has a count of either kind.
 *
 * On 2026-09-30 that is 75 benchmark files, 72 package-counts and 60
 * process-counts: the 15 missing process-counts are the 12 `registry-*` plus
 * `next-build`, `next-build-cache` and `run-run`, and those same three are the
 * only missing package-counts.
 *
 * Consult `apps/data`'s manifest, which records the three kinds separately
 * rather than deriving one from another.
 */
export type ProcessCount = { [series: string]: ProcessCountEntry | undefined };

// ---------------------------------------------------------------------------
// /{date}/versions.json
// ---------------------------------------------------------------------------

/**
 * `/{date}/versions.json` -- the tool versions a run measured.
 *
 * Values are version strings as each tool reports them, so they are not
 * uniformly formatted (`node` is reported with a leading `v`). The key set has
 * grown as package managers were added, and `latest/` carries no
 * `versions.json` at all.
 */
export type Versions = { [tool: string]: string | undefined };

// ---------------------------------------------------------------------------
// /{date}/chart-data.json  -- generate-chart.js output
// ---------------------------------------------------------------------------

/**
 * One row of chart data: a fixture plus one group of keys per series.
 *
 * The shape is dynamic by design. For a series `s` a row may carry:
 *
 * - `s`          the mean, in seconds
 * - `s_fill`     the series colour, as a hex string
 * - `s_stddev`   the standard deviation, in seconds
 * - `s_count`    the package count -- only in the `perPackageCount` sections
 * - `s_dnf`      true when the series did not finish
 *
 * Which series appear varies per variation, so every lookup is optional.
 */
export interface ChartRow {
  fixture: string;
  [seriesKey: string]: string | number | boolean | undefined;
}

/** One chart section. All four keys were present in every section surveyed. */
export interface ChartSection {
  /** Series name to hex colour. */
  colors: { [series: string]: string | undefined };
  /** Variation to one row per fixture. */
  data: { [variation: string]: ChartRow[] | undefined };
  /** Series names this section plots. */
  packageManagers: string[];
  /** Variations this section plots. */
  variations: string[];
}

/**
 * `/{date}/chart-data.json`.
 *
 * **Only `chartData` and `perPackageCountChartData` are present in all 352
 * published date directories.** The rest were added over time and are absent
 * from older ones:
 *
 * | first seen  | added                                            |
 * | ----------- | ------------------------------------------------ |
 * | 2025-08-22  | `chartData`, `perPackageCountChartData`          |
 * | 2025-09-02  | `versions`                                       |
 * | 2025-09-08  | `date`                                           |
 * | 2026-02-27  | `registryChartData`                              |
 * | 2026-03-11  | `commitSha`                                      |
 * | 2026-03-31  | `registryPerPackageCountChartData`               |
 *
 * A consumer that treats any of the optional fields as required will throw on
 * roughly the first half of the archive.
 */
export interface ChartData {
  chartData: ChartSection;
  perPackageCountChartData: ChartSection;
  registryChartData?: ChartSection;
  registryPerPackageCountChartData?: ChartSection;
  date?: DateKey;
  commitSha?: string;
  versions?: Versions;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

const FIXTURE_SET: ReadonlySet<string> = new Set<string>(FIXTURES);
const VARIATION_SET: ReadonlySet<string> = new Set<string>(VARIATIONS);

export const isFixture = (value: unknown): value is Fixture =>
  typeof value === "string" && FIXTURE_SET.has(value);

/**
 * True when the suite runs this variation today. **Not** a validity check for
 * the published tree -- see {@link Variation}.
 */
export const isVariation = (value: unknown): value is Variation =>
  typeof value === "string" && VARIATION_SET.has(value);

/**
 * True for a `yyyy-mm-dd` string that is also a real calendar date, so
 * `2026-02-30` is rejected.
 */
export const isDateKey = (value: unknown): value is DateKey => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString().startsWith(value);
};

/**
 * The basename, without extension, of the benchmark file for a fixture and
 * variation. The `+` in some variation names is preserved -- encode it
 * yourself if the result becomes a URL path segment.
 */
export const benchmarkFileStem = (fixture: Fixture, variation: Variation): string =>
  `${fixture}-${variation}`;
