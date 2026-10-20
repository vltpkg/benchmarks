/**
 * Server-side loading for one scenario.
 *
 * Every fetch here is a measurement file. Nothing reads `chart-data.json`:
 * it is derived, it has drifted into six shapes across the archive, and on
 * 2026-04-14 it describes registry data that does not exist. The files are the
 * measurement.
 */
import type { BenchmarkFile, Fixture, PackageCount, ProcessCount } from "@benchmarks/types";
import { DataClient } from "@benchmarks/data";
import { probe } from "./data";
import { applyExclusions } from "./figures";
import { averageFiles, usable } from "./measurements";

export interface FixtureBundle {
  readonly fixture: string;
  readonly file: BenchmarkFile;
  readonly counts: PackageCount | null;
  readonly processes: ProcessCount | null;
}

export interface TrendPoint {
  readonly date: string;
  /** The fixtures that published a file for this scenario on this date. */
  readonly fixtures: readonly string[];
  /**
   * Mean seconds per tool across `fixtures` -- present ONLY when the tool
   * completed every one of them. A mean over fewer fixtures than its
   * neighbours is not comparable with them: a tool that skipped the slowest
   * fixture would draw a dip it did not earn. Such a day is in `partial`.
   */
  readonly byTool: { readonly [tool: string]: number | undefined };
  /** The mean over the fixtures a tool did complete, when it did not complete all. */
  readonly partial: { readonly [tool: string]: { readonly mean: number; readonly of: number } };
  /** The fixtures a tool ran and failed on, with the first non-zero exit code. */
  readonly failed: {
    readonly [tool: string]: readonly { readonly fixture: string; readonly exit: number }[];
  };
  /** Each tool's seconds on each fixture it completed. */
  readonly byFixture: { readonly [tool: string]: { readonly [fixture: string]: number } };
  /** Pooled standard deviation as a fraction of the mean, as `meanByTool` computes it. */
  readonly rsd: { readonly [tool: string]: number };
  /** Each fixture's own standard deviation as a fraction of its mean. */
  readonly rsdByFixture: { readonly [tool: string]: { readonly [fixture: string]: number } };
  /** Milliseconds per installed package, mean across fixtures; only when asked for. */
  readonly perPackage?: { readonly [tool: string]: number | undefined };
  /** Milliseconds per installed package on each fixture a tool completed and has a count for. */
  readonly perPackageByFixture?: {
    readonly [tool: string]: { readonly [fixture: string]: number };
  };
}

export interface ScenarioData {
  readonly bundles: readonly FixtureBundle[];
  readonly trend: readonly TrendPoint[];
  /** What the trend actually cost, so the number is reported rather than guessed. */
  readonly trendCost: { readonly requests: number; readonly dates: number };
}

const asFixture = (name: string): Fixture => name as Fixture;

/** One fixture's three files. The two count files are independently optional. */
const loadFixture = async (
  client: DataClient,
  date: string,
  fixture: string,
  variation: string,
): Promise<FixtureBundle | null> => {
  const file = await probe<BenchmarkFile>(() =>
    client.getBenchmark(date, asFixture(fixture), variation),
  );
  if (file.state !== "present") return null;

  const [counts, processes] = await Promise.all([
    probe<PackageCount>(() => client.getPackageCount(date, asFixture(fixture), variation)),
    probe<ProcessCount>(() => client.getProcessCount(date, asFixture(fixture), variation)),
  ]);

  return {
    fixture,
    file: file.value,
    counts: counts.state === "present" ? counts.value : null,
    processes: processes.state === "present" ? processes.value : null,
  };
};

/**
 * One date's trend point from that date's files. Pure, so the rule that a
 * partial mean is never plotted can be tested without a data server.
 */
export const trendPoint = (
  date: string,
  files: readonly { readonly fixture: string; readonly file: BenchmarkFile }[],
  counts: readonly { readonly fixture: string; readonly counts: PackageCount }[] = [],
): TrendPoint | null => {
  const fixtures = files.map((f) => f.fixture);
  const acc = new Map<string, { sum: number; varSum: number; n: number }>();
  const failed: { [tool: string]: { fixture: string; exit: number }[] } = {};
  const byFixture: { [tool: string]: { [fixture: string]: number } } = {};
  const rsdByFixture: { [tool: string]: { [fixture: string]: number } } = {};
  for (const { fixture, file } of files) {
    for (const result of file.results) {
      const tool = result.command;
      // Same rule as the leaderboard, so a crash does not become a dip.
      if (!usable(result)) {
        (failed[tool] ??= []).push({
          fixture,
          exit: result.exit_codes?.find((c) => c !== 0) ?? Number.NaN,
        });
        continue;
      }
      const entry = acc.get(tool) ?? { sum: 0, varSum: 0, n: 0 };
      entry.sum += result.mean;
      entry.varSum += Number.isFinite(result.stddev) ? result.stddev ** 2 : 0;
      entry.n += 1;
      acc.set(tool, entry);
      (byFixture[tool] ??= {})[fixture] = result.mean;
      if (Number.isFinite(result.stddev) && result.mean > 0)
        (rsdByFixture[tool] ??= {})[fixture] = result.stddev / result.mean;
    }
  }
  if (acc.size === 0 && Object.keys(failed).length === 0) return null;

  const byTool: { [tool: string]: number | undefined } = {};
  const partial: { [tool: string]: { mean: number; of: number } } = {};
  const rsd: { [tool: string]: number } = {};
  for (const [tool, { sum, varSum, n }] of acc) {
    const mean = sum / n;
    rsd[tool] = mean > 0 ? Math.sqrt(varSum / n) / mean : 0;
    if (n >= fixtures.length) byTool[tool] = mean;
    else partial[tool] = { mean, of: n };
  }

  let perPackage: { [tool: string]: number | undefined } | undefined;
  let perPackageByFixture: { [tool: string]: { [fixture: string]: number } } | undefined;
  if (counts.length > 0) {
    perPackage = {};
    perPackageByFixture = {};
    for (const [tool, seconds] of Object.entries(byFixture)) {
      for (const [f, s] of Object.entries(seconds)) {
        const count = counts.find((c) => c.fixture === f)?.counts[tool]?.count;
        if (count !== undefined && count > 0)
          (perPackageByFixture[tool] ??= {})[f] = (s * 1000) / count;
      }
    }
    for (const tool of Object.keys(byTool)) {
      const each = fixtures.map((f) => {
        const seconds = byFixture[tool]?.[f];
        const count = counts.find((c) => c.fixture === f)?.counts[tool]?.count;
        return seconds !== undefined && count !== undefined && count > 0
          ? (seconds * 1000) / count
          : null;
      });
      perPackage[tool] = each.every((v) => v !== null)
        ? each.reduce<number>((sum, v) => sum + (v ?? 0), 0) / each.length
        : undefined;
    }
  }

  return {
    date,
    fixtures,
    byTool,
    partial,
    failed,
    byFixture,
    rsd,
    rsdByFixture,
    perPackage,
    perPackageByFixture,
  };
};

/**
 * The trend series behind the sparklines and the time chart.
 *
 * Cost is `dates x fixtures` requests, doubled when package counts are asked
 * for; `trendCost` reports the real number. Dates the scenario did not run on
 * contribute no point, which is why the series can be shorter than the window.
 */
const loadTrend = async (
  client: DataClient,
  dates: readonly string[],
  fixtures: readonly string[],
  variation: string,
  withCounts: boolean,
): Promise<{ trend: TrendPoint[]; requests: number }> => {
  const perDate = await Promise.all(
    dates.map(async (date) => {
      const loaded = await Promise.all(
        fixtures.map(async (fixture) => {
          const [file, counts] = await Promise.all([
            probe<BenchmarkFile>(() => client.getBenchmark(date, asFixture(fixture), variation)),
            withCounts
              ? probe<PackageCount>(() =>
                  client.getPackageCount(date, asFixture(fixture), variation),
                )
              : null,
          ]);
          return {
            fixture,
            file: file.state === "present" ? file.value : null,
            counts: counts?.state === "present" ? counts.value : null,
          };
        }),
      );
      return trendPoint(
        date,
        loaded.flatMap((l) => (l.file === null ? [] : [{ fixture: l.fixture, file: l.file }])),
        loaded.flatMap((l) =>
          l.counts === null ? [] : [{ fixture: l.fixture, counts: l.counts }],
        ),
      );
    }),
  );

  return {
    trend: perDate.filter((p): p is TrendPoint => p !== null),
    requests: dates.length * fixtures.length * (withCounts ? 2 : 1),
  };
};

export const loadScenario = async (
  client: DataClient,
  date: string,
  variation: string,
  fixtures: readonly string[],
  trendDates: readonly string[],
  options: { readonly exclude?: readonly string[]; readonly perPackage?: boolean } = {},
): Promise<ScenarioData> => {
  const [bundles, trend] = await Promise.all([
    Promise.all(fixtures.map((f) => loadFixture(client, date, f, variation))),
    loadTrend(client, trendDates, fixtures, variation, options.perPackage === true),
  ]);

  return {
    bundles: bundles.filter((b): b is FixtureBundle => b !== null),
    trend: applyExclusions(trend.trend, options.exclude ?? []),
    trendCost: { requests: trend.requests, dates: trendDates.length },
  };
};

/**
 * What the derived "average" view's trend may fetch per page. One run costs a
 * file per (fixture, scenario) -- 54 for package managers -- so a 30-day
 * window would be about 1,600 requests; the window is cut to its most recent
 * runs instead.
 */
export const AVERAGE_TREND_BUDGET = 400;

/** The most recent dates whose files fit the budget, and never fewer than two. */
export const averageTrendDates = (dates: readonly string[], cellsPerDate: number): string[] =>
  dates.slice(-Math.max(2, Math.floor(AVERAGE_TREND_BUDGET / Math.max(cellsPerDate, 1))));

/** One measured scenario's file for one fixture. */
export interface RunCell {
  readonly fixture: string;
  readonly variation: string;
  readonly file: BenchmarkFile;
}

const loadCells = async (
  client: DataClient,
  date: string,
  plan: { readonly [fixture: string]: readonly string[] },
): Promise<RunCell[]> => {
  const cells = await Promise.all(
    Object.entries(plan).flatMap(([fixture, variations]) =>
      variations.map(async (variation) => {
        const file = await probe<BenchmarkFile>(() =>
          client.getBenchmark(date, asFixture(fixture), variation),
        );
        return file.state === "present" ? [{ fixture, variation, file: file.value }] : [];
      }),
    ),
  );
  return cells.flat();
};

/**
 * The derived "average" view, as a scenario: `plan` maps each fixture to the
 * scenarios averaged on it. `cells` are the shown run's per-scenario files it
 * was averaged from. No count files -- a package or process count is a
 * fact about one scenario, and a mean of them describes no install.
 */
export const loadAverage = async (
  client: DataClient,
  date: string,
  plan: { readonly [fixture: string]: readonly string[] },
  trendDates: readonly string[],
  options: { readonly exclude?: readonly string[] } = {},
): Promise<ScenarioData & { readonly cells: readonly RunCell[] }> => {
  // The run shown is usually the trend's last date; fetched once either way.
  const dates = trendDates.includes(date) ? trendDates : [...trendDates, date];
  const loaded = await Promise.all(dates.map((d) => loadCells(client, d, plan)));
  const trend = trendDates.flatMap(
    (d, i) => trendPoint(d, averageFiles(loaded[i] ?? [], plan)) ?? [],
  );
  const cells = loaded[dates.indexOf(date)] ?? [];

  return {
    cells,
    bundles: averageFiles(cells, plan).map((b) => ({
      ...b,
      counts: null,
      processes: null,
    })),
    trend: applyExclusions(trend, options.exclude ?? []),
    trendCost: {
      requests: dates.length * Object.values(plan).flat().length,
      dates: trendDates.length,
    },
  };
};
