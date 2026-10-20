/**
 * Turning published benchmark files into the numbers the sections render.
 *
 * Everything here reads the actual measurement files. `chart-data.json` is
 * deliberately not used: it is derived, it has drifted into six shapes across
 * the archive, and on at least one date it describes data that does not exist.
 * The benchmark files are the measurement.
 */
import type { BenchmarkFile, BenchmarkResult, PackageCount, ProcessCount } from "@benchmarks/types";

/** The eleven the `package-managers` section compares, per `tmp/app`. */
export const PACKAGE_MANAGERS = [
  "bun",
  "vlt",
  "zpm",
  "upm",
  "aube",
  "pacquet",
  "pnpm",
  "deno",
  "berry",
  "yarn",
  "npm",
] as const;

export interface ToolMean {
  readonly tool: string;
  /** Mean seconds across the fixtures that measured this tool. */
  readonly mean: number;
  /** Pooled standard deviation, as a fraction of the mean. */
  readonly rsd: number;
  /** How many fixtures contributed. Fewer than the section's total is partial. */
  readonly fixtures: number;
  /** True when any contributing run exited non-zero. */
  readonly failed: boolean;
}

/** One fixture's per-tool seconds. */
export interface FixtureRow {
  readonly fixture: string;
  readonly values: readonly { readonly tool: string; readonly value: number }[];
  /**
   * Tools that ran on this fixture and produced nothing usable.
   *
   * Kept apart from `values` so a crash can be PRINTED as "DNF" without ever
   * being plotted or ranked. Without it a failed run and a tool that was never
   * scheduled both render as the same blank cell.
   */
  readonly failed: readonly string[];
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Whether a result is a measurement of the thing it claims to measure.
 *
 * The suite runs hyperfine with `--ignore-failure`, so a tool that errors is
 * still timed and its non-zero exit code recorded. Those timings are not
 * install times -- a real case in the published data is `zpm` on `babylon`,
 * 2026-10-02: **mean 0.000s, exit_codes [1]**. Averaged in as if it were a
 * measurement it drags zpm's cross-fixture mean to first place, presenting a
 * tool that crashed on the largest fixture as the fastest overall.
 *
 * So a failed run contributes nothing to any number. It is still REPORTED --
 * `failed` on the tool, and a fixture count below the section's total -- but
 * never averaged, plotted or ranked.
 */
export const completed = (result: { readonly exit_codes?: readonly number[] }): boolean =>
  (result.exit_codes ?? []).every((c) => c === 0);

/**
 * Whether a result can be used as a number at all.
 *
 * Two conditions, mirroring `generate-chart.js:179`'s `didFail`. That file
 * derives its own `failed` flag from `exitCodes.some(c => c !== 0)`
 * (`generate-chart.js:88-99`) -- the same predicate as {@link completed},
 * arrived at independently -- and adds a non-finite guard.
 *
 * The non-finite half has no instances in the surveyed tree (0 of 3,665
 * results) but is guarded anyway, because "probably rare" is exactly how the
 * 0.000s sentinel reached rank one. Unusable results are REPORTED rather than
 * skipped in silence: a tool that vanishes without explanation is the other
 * failure this repository keeps producing.
 */
export const usable = (result: {
  readonly mean?: unknown;
  readonly exit_codes?: readonly number[];
}): boolean => typeof result.mean === "number" && Number.isFinite(result.mean) && completed(result);

/**
 * Mean per tool across fixtures.
 *
 * A tool missing from a fixture is skipped rather than counted as zero -- not
 * every tool runs on every fixture, and a zero would make a tool that did not
 * run look instantaneous.
 */
export const meanByTool = (
  files: readonly { readonly fixture: string; readonly file: BenchmarkFile }[],
  tools: readonly string[],
): ToolMean[] => {
  const acc = new Map<string, { sum: number; varSum: number; n: number; failed: boolean }>();

  for (const { file } of files) {
    for (const result of file.results) {
      if (!tools.includes(result.command)) continue;
      const entry = acc.get(result.command) ?? { sum: 0, varSum: 0, n: 0, failed: false };
      if (!usable(result)) {
        // Recorded, never averaged -- and recorded even when the reason is a
        // non-finite mean rather than a failing exit, so it is visible.
        entry.failed = true;
        acc.set(result.command, entry);
        continue;
      }
      entry.sum += result.mean;
      entry.varSum += finite(result.stddev) ? result.stddev ** 2 : 0;
      entry.n += 1;
      acc.set(result.command, entry);
    }
  }

  return [...acc.entries()]
    .filter(([, e]) => e.n > 0)
    .map(([tool, e]) => {
      const mean = e.sum / e.n;
      return {
        tool,
        mean,
        rsd: mean > 0 ? Math.sqrt(e.varSum / e.n) / mean : 0,
        fixtures: e.n,
        failed: e.failed,
      };
    })
    .sort((a, b) => a.mean - b.mean);
};

/**
 * The derived "average" view: one file per fixture, each tool's seconds the
 * mean of its seconds in every scenario `plan` lists for that fixture.
 *
 * `main` averaged over whatever each tool happened to complete, so a tool that
 * crashed in the slowest scenario got a mean over the fast ones and could rank
 * first. Here a value exists only when the tool completed EVERY listed
 * scenario on the fixture, so all values on a fixture cover the same runs:
 *
 * - failed in any of them: kept as a failed result (the first failure's exit
 *   codes, no mean), so it reads as DNF and is never averaged;
 * - not run in all of them: left out, as a tool not run on that fixture is;
 * - a listed scenario with no file for the fixture: the fixture is dropped,
 *   since its mean would cover different scenarios from its neighbours'.
 *
 * The output feeds `meanByTool`, `byFixture` and `trendPoint` unchanged, so
 * the across-fixture rules -- partial is never ranked or plotted -- apply as
 * they do to a measured scenario.
 */
export const averageFiles = (
  cells: readonly {
    readonly fixture: string;
    readonly variation: string;
    readonly file: BenchmarkFile;
  }[],
  plan: { readonly [fixture: string]: readonly string[] },
): { fixture: string; file: BenchmarkFile }[] =>
  Object.entries(plan).flatMap(([fixture, variations]) => {
    const files = variations.map(
      (v) => cells.find((c) => c.fixture === fixture && c.variation === v)?.file,
    );
    if (files.length === 0 || files.some((f) => f === undefined)) return [];
    const runs = files as BenchmarkFile[];
    const tools = [...new Set(runs.flatMap((f) => f.results.map((r) => r.command)))];
    const derived = {
      median: Number.NaN,
      min: Number.NaN,
      max: Number.NaN,
      user: Number.NaN,
      system: Number.NaN,
      times: [],
    };
    const results = tools.flatMap((command) => {
      const each = runs.map((f) => f.results.find((r) => r.command === command));
      const failure = each.find((r) => r !== undefined && !usable(r));
      if (failure !== undefined) {
        return [
          {
            ...derived,
            command,
            mean: Number.NaN,
            stddev: Number.NaN,
            exit_codes: failure.exit_codes,
          },
        ];
      }
      // ponytail: a tool run in only some scenarios on EVERY fixture vanishes from the view; surface it if that case is ever published.
      if (each.some((r) => r === undefined)) return [];
      const done = each as BenchmarkResult[];
      const avg = (pick: (r: BenchmarkResult) => number) =>
        done.reduce((sum, r) => sum + pick(r), 0) / done.length;
      return [
        {
          ...derived,
          command,
          mean: avg((r) => r.mean),
          stddev: Math.sqrt(avg((r) => (finite(r.stddev) ? r.stddev ** 2 : 0))),
          exit_codes: [],
        },
      ];
    });
    return [{ fixture, file: { results } }];
  });

const failedIn = (file: BenchmarkFile, tools: readonly string[]): string[] =>
  file.results.filter((r) => tools.includes(r.command) && !usable(r)).map((r) => r.command);

/**
 * Tools the files name that have no usable result on ANY fixture.
 *
 * `meanByTool` cannot rank these -- there is nothing to average -- so they
 * drop out of its result entirely. This is the list that lets the page say so
 * instead of letting a tool that crashed everywhere simply not be there.
 */
export const unranked = (
  files: readonly { readonly file: BenchmarkFile }[],
  tools: readonly string[],
): string[] =>
  tools.filter(
    (tool) =>
      files.some(({ file }) => file.results.some((r) => r.command === tool)) &&
      !files.some(({ file }) => file.results.some((r) => r.command === tool && usable(r))),
  );

/** Per-fixture rows, ordered by the fixture list given. */
export const byFixture = (
  files: readonly { readonly fixture: string; readonly file: BenchmarkFile }[],
  tools: readonly string[],
): FixtureRow[] =>
  files.map(({ fixture, file }) => ({
    fixture,
    values: file.results
      .filter((r) => tools.includes(r.command) && usable(r))
      .map((r) => ({ tool: r.command, value: r.mean })),
    failed: failedIn(file, tools),
  }));

/**
 * Milliseconds per installed package.
 *
 * The normalisation the methodology exists for: tools disagree about what a
 * dependency graph contains, so wall-clock alone rewards installing less. A
 * tool with timings but no package count is omitted rather than divided by
 * zero or by a guess.
 */
export const perPackageByFixture = (
  files: readonly {
    readonly fixture: string;
    readonly file: BenchmarkFile;
    readonly counts: PackageCount | null;
  }[],
  tools: readonly string[],
): FixtureRow[] =>
  files.map(({ fixture, file, counts }) => ({
    fixture,
    failed: failedIn(file, tools),
    values:
      counts === null
        ? []
        : file.results.flatMap((r) => {
            if (!tools.includes(r.command) || !usable(r)) return [];
            const count = counts[r.command]?.count;
            if (!finite(count) || count <= 0) return [];
            return [{ tool: r.command, value: (r.mean * 1000) / count }];
          }),
  }));

/** A tool's package or process counts across fixtures, for the §4 tables. */
export interface CountRow {
  readonly tool: string;
  readonly byFixture: { readonly [fixture: string]: number | undefined };
  /**
   * `[min, max]` where the published entry carries a range that is not a
   * single value -- a tool whose installs did not all produce the same count.
   */
  readonly ranges: { readonly [fixture: string]: readonly [number, number] | undefined };
  readonly total: number;
}

export const countRows = (
  files: readonly {
    readonly fixture: string;
    readonly counts: PackageCount | ProcessCount | null;
  }[],
  tools: readonly string[],
): CountRow[] => {
  const acc = new Map<
    string,
    {
      byFixture: { [f: string]: number | undefined };
      ranges: { [f: string]: readonly [number, number] | undefined };
      total: number;
    }
  >();
  for (const { fixture, counts } of files) {
    if (counts === null) continue;
    for (const [tool, entry] of Object.entries(counts)) {
      if (!tools.includes(tool)) continue;
      const count = entry?.count;
      if (!finite(count)) continue;
      const row = acc.get(tool) ?? { byFixture: {}, ranges: {}, total: 0 };
      row.byFixture[fixture] = count;
      const min = (entry as { minCount?: unknown }).minCount;
      const max = (entry as { maxCount?: unknown }).maxCount;
      if (finite(min) && finite(max) && min !== max) row.ranges[fixture] = [min, max];
      row.total += count;
      acc.set(tool, row);
    }
  }
  return [...acc.entries()]
    .map(([tool, r]) => ({ tool, byFixture: r.byFixture, ranges: r.ranges, total: r.total }))
    .sort((a, b) => a.total - b.total);
};

/** Ratio against a baseline tool, as the leaderboard's "vs npm" column. */
export const ratioTo = (mean: number, baseline: number | undefined): number | null =>
  baseline === undefined || baseline <= 0 || mean <= 0 ? null : baseline / mean;

export const formatSeconds = (s: number): string =>
  s >= 100 ? s.toFixed(0) : s >= 10 ? s.toFixed(1) : s.toFixed(2);

export const formatMs = (ms: number): string => (ms >= 100 ? ms.toFixed(0) : ms.toFixed(1));
