import { useState, useEffect } from "react";
import type { HistoryData, HistoryVariation } from "@/types/history";

/** Max days to attempt fetching (generates date strings, 404s are skipped) */
const MAX_DAYS = 180;

/** How many fetches to run in parallel */
const CONCURRENCY = 10;

const PACKAGE_MANAGERS = [
  "npm",
  "yarn",
  "pnpm",
  "pnpm11",
  "berry",
  "zpm",
  "deno",
  "bun",
  "vlt",
  "nx",
  "turbo",
  "vp",
  "node",
  "aws",
  "cloudsmith",
  "github",
];

interface UseHistoryDataReturn {
  historyData: HistoryData | null;
  loading: boolean;
  error: string | null;
}

/** Generate YYYY-MM-DD strings for the last N days (most recent last) */
function generateDateStrings(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Run async tasks with a concurrency limit */
async function parallelLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

type FixtureDataSet = Record<
  string,
  Array<Record<string, number | string> & { fixture: string }>
>;

interface ChartDataResponse {
  date: string;
  chartData: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
  perPackageCountChartData?: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
  registryChartData?: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
}

/**
 * Extract per-PM averages (across fixtures) for each variation from a single
 * day's chart-data.json response.
 *
 * For package-management variations (clean, cache, lockfile, etc.) we use
 * perPackageCountChartData when available — these values are already in ms/pkg
 * and match what the leaderboard cards display.  Falls back to total-time
 * chartData for older files that lack per-package data.
 *
 * Registry and task-runner variations always use total-time data.
 */
function extractDayData(
  response: ChartDataResponse,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  // Use per-package data for package-management variations when available,
  // otherwise fall back to total-time chartData
  const pmSource =
    response.perPackageCountChartData?.data ?? response.chartData.data;
  extractFromDataSet(pmSource, result);

  // Process registry chart data (separate data set, always total time)
  if (response.registryChartData?.data) {
    extractFromDataSet(response.registryChartData.data, result);
  }

  return result;
}

function extractFromDataSet(
  data: Record<
    string,
    Array<Record<string, number | string> & { fixture: string }>
  >,
  result: Record<string, Record<string, number>>,
): void {
  for (const [variation, fixtures] of Object.entries(data)) {
    if (!Array.isArray(fixtures) || fixtures.length === 0) continue;

    const pmTotals: Record<string, { sum: number; count: number }> = {};

    for (const fixture of fixtures) {
      for (const pm of PACKAGE_MANAGERS) {
        const val = fixture[pm];
        if (typeof val === "number" && Number.isFinite(val)) {
          if (!pmTotals[pm]) pmTotals[pm] = { sum: 0, count: 0 };
          pmTotals[pm].sum += val;
          pmTotals[pm].count++;
        }
      }
    }

    const pmAverages: Record<string, number> = {};
    for (const [pm, { sum, count }] of Object.entries(pmTotals)) {
      pmAverages[pm] = Math.round((sum / count) * 1000) / 1000;
    }

    if (Object.keys(pmAverages).length > 0) {
      result[variation] = pmAverages;
    }
  }
}

export const useHistoryData = (): UseHistoryDataReturn => {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const dateStrings = generateDateStrings(MAX_DAYS);

        // Fetch each date's chart-data.json in parallel with concurrency limit
        type FetchResult = { date: string; data: ChartDataResponse } | null;

        const tasks = dateStrings.map(
          (date) => async (): Promise<FetchResult> => {
            try {
              const response = await fetch(`/${date}/chart-data.json`);
              if (!response.ok) return null;
              const data: ChartDataResponse = await response.json();
              return { date, data };
            } catch {
              return null;
            }
          },
        );

        const results = await parallelLimit(tasks, CONCURRENCY);

        // Build the HistoryData structure from successful fetches
        const successfulResults = results.filter(
          (r): r is NonNullable<FetchResult> => r !== null,
        );

        if (successfulResults.length < 2) {
          // Not enough data to show a meaningful chart
          setHistoryData(null);
          return;
        }

        // Collect all variations seen across all dates
        const allVariations = new Set<string>();
        const dayDataMap = new Map<
          string,
          Record<string, Record<string, number>>
        >();

        for (const { date, data } of successfulResults) {
          const dayData = extractDayData(data);
          dayDataMap.set(date, dayData);
          for (const variation of Object.keys(dayData)) {
            allVariations.add(variation);
          }
        }

        const dates = successfulResults.map((r) => r.date);
        const variations: Record<string, HistoryVariation> = {};

        for (const variation of allVariations) {
          const pmSeries: HistoryVariation = {};
          for (const pm of PACKAGE_MANAGERS) {
            pmSeries[pm] = [];
          }

          for (const date of dates) {
            const dayData = dayDataMap.get(date);
            const varData = dayData?.[variation];
            for (const pm of PACKAGE_MANAGERS) {
              pmSeries[pm].push(varData?.[pm] ?? null);
            }
          }

          // Only include variation if it has data
          const hasData = Object.values(pmSeries).some((arr) =>
            arr.some((v) => v !== null),
          );
          if (hasData) {
            variations[variation] = pmSeries;
          }
        }

        // Compute synthetic "average" variation from package management variations
        const PM_VARIATIONS = [
          "clean",
          "node_modules",
          "cache",
          "cache+node_modules",
          "cache+lockfile",
          "cache+lockfile+node_modules",
          "lockfile",
          "lockfile+node_modules",
        ];
        const presentPmVariations = PM_VARIATIONS.filter(
          (v) => variations[v],
        );

        if (presentPmVariations.length > 0) {
          const avgSeries: HistoryVariation = {};
          for (const pm of PACKAGE_MANAGERS) {
            avgSeries[pm] = [];
            for (let i = 0; i < dates.length; i++) {
              let sum = 0;
              let count = 0;
              for (const v of presentPmVariations) {
                const val = variations[v][pm]?.[i];
                if (val !== null && val !== undefined) {
                  sum += val;
                  count++;
                }
              }
              avgSeries[pm].push(
                count > 0 ? Math.round((sum / count) * 1000) / 1000 : null,
              );
            }
          }
          variations["average"] = avgSeries;
        }

        setHistoryData({ dates, variations });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.warn("History data not available:", msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return { historyData, loading, error };
};
