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
 */
import type { BenchmarkResult } from "@benchmarks/types";
import type { DirectoryListing } from "./manifest.ts";
import { parseDataFile } from "./paths.ts";

/** What a trend needs of a result, exactly as the benchmark file has it. */
export type SummaryResult = Pick<BenchmarkResult, "command" | "mean" | "stddev" | "exit_codes">;

/** Variation, then fixture, to that file's results. */
export type DateSummary = {
  [variation: string]: { [fixture: string]: SummaryResult[] | undefined } | undefined;
};

/**
 * Summarise one date directory. `read` returns a file's text; a file that
 * does not parse as a benchmark file is reported in `skipped`, not guessed at.
 */
export const buildSummary = (
  listing: DirectoryListing,
  read: (file: string) => string,
): { summary: DateSummary; skipped: string[] } => {
  const summary: DateSummary = {};
  const skipped: string[] = [];
  for (const file of listing.files) {
    const parsed = parseDataFile(file);
    if (parsed?.kind !== "benchmark") continue;
    let results: unknown;
    try {
      results = (JSON.parse(read(file)) as { results?: unknown }).results;
    } catch {
      results = undefined;
    }
    if (!Array.isArray(results)) {
      skipped.push(file);
      continue;
    }
    (summary[parsed.variation] ??= {})[parsed.fixture] = (results as BenchmarkResult[]).map(
      ({ command, mean, stddev, exit_codes }) => ({ command, mean, stddev, exit_codes }),
    );
  }
  return { summary, skipped };
};
