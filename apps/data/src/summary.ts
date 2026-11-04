/**
 * One date's benchmark results, in one file.
 *
 * A trend over many scenarios -- the "average" view averages every scenario
 * on every fixture -- otherwise costs one fetch per benchmark file per run:
 * 54 a run for package managers, about 6,500 for 120 days. This is the same
 * numbers, lifted verbatim out of those files, so it costs one.
 *
 * Not `chart-data.json`. That file gives a failed run a time, and nothing in
 * it says the run failed. Every result here keeps its `exit_codes`, so a
 * consumer applies the same rule to it as to the file it came from.
 *
 * The date's package counts and `versions.json` ride along,
 * verbatim, under reserved `#` keys beside the variations -- so a summary
 * written before they existed is still a valid one, and a reader that only
 * looks up variations never sees them. Each is optional: absent means "not in
 * this summary", and the reader falls back to the file; it never means zero.
 */
import type { BenchmarkResult, PackageCount, Versions } from "@benchmarks/types";
import type { DirectoryListing } from "./manifest.ts";
import { parseDataFile, VERSIONS_FILE } from "./paths.ts";

/** What a trend needs of a result, exactly as the benchmark file has it. */
export type SummaryResult = Pick<BenchmarkResult, "command" | "mean" | "stddev" | "exit_codes">;

/** Variation, then fixture, to that file's results. */
export type DateSummary = {
  [variation: string]: { [fixture: string]: SummaryResult[] | undefined } | undefined;
};

/** Variation, then fixture, to that count file as published. */
export type SummaryCounts<T> = {
  [variation: string]: { [fixture: string]: T | undefined } | undefined;
};

export const SUMMARY_PACKAGE_COUNTS = "#packageCounts";
export const SUMMARY_VERSIONS = "#versions";

/* The reserved keys, read without letting them widen every variation's type. */
const extra = (summary: DateSummary, key: string): unknown =>
  (summary as { readonly [key: string]: unknown })[key];

/** This summary's package counts, or `undefined` when it does not carry them. */
export const summaryPackageCounts = (
  summary: DateSummary,
): SummaryCounts<PackageCount> | undefined =>
  extra(summary, SUMMARY_PACKAGE_COUNTS) as SummaryCounts<PackageCount> | undefined;

/** The date's `versions.json`, or `undefined` when the summary does not carry it. */
export const summaryVersions = (summary: DateSummary): Versions | undefined =>
  extra(summary, SUMMARY_VERSIONS) as Versions | undefined;

const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Summarise one date directory. `read` returns a file's text; a file that
 * does not parse as what its name says is reported in `skipped`, not guessed at.
 */
export const buildSummary = (
  listing: DirectoryListing,
  read: (file: string) => string,
): { summary: DateSummary; skipped: string[] } => {
  // A variation is whatever the file name says, `__proto__` included.
  const summary: DateSummary = Object.create(null);
  const packageCounts: SummaryCounts<PackageCount> = Object.create(null);
  const skipped: string[] = [];
  for (const file of listing.files) {
    if (file === VERSIONS_FILE) {
      const versions = parse(read(file));
      if (isObject(versions)) {
        (summary as { [key: string]: unknown })[SUMMARY_VERSIONS] = versions;
      } else skipped.push(file);
      continue;
    }
    const parsed = parseDataFile(file);
    if (parsed === undefined) continue;
    // A variation named like a reserved key would be read as one.
    if (parsed.variation.startsWith("#")) {
      skipped.push(file);
      continue;
    }
    // Process counts stay out until something reads them from here.
    if (parsed.kind === "process-count") continue;
    const content = parse(read(file));
    if (parsed.kind === "package-count") {
      if (isObject(content)) {
        (packageCounts[parsed.variation] ??= {})[parsed.fixture] = content as PackageCount;
      } else skipped.push(file);
      continue;
    }
    const results = isObject(content) ? (content as { results?: unknown }).results : undefined;
    if (!Array.isArray(results) || !results.every((r) => typeof r === "object" && r !== null)) {
      skipped.push(file);
      continue;
    }
    (summary[parsed.variation] ??= {})[parsed.fixture] = (results as BenchmarkResult[]).map(
      ({ command, mean, stddev, exit_codes }) => ({ command, mean, stddev, exit_codes }),
    );
  }
  if (Object.keys(packageCounts).length > 0) {
    (summary as { [key: string]: unknown })[SUMMARY_PACKAGE_COUNTS] = packageCounts;
  }
  return { summary, skipped };
};
