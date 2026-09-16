import { useState, useEffect } from "react";
import type { HistoryData, HistoryVariation } from "@/types/history";
import { PACKAGE_MANAGERS, extractDayData } from "@/lib/history-data";
import type { ChartDataResponse } from "@/lib/history-data";

/** Max days to attempt fetching (generates date strings, 404s are skipped) */
const MAX_DAYS = 180;

/** How many fetches to run in parallel */
const CONCURRENCY = 10;

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

        // Compute synthetic average variations by averaging across
        // the constituent variations in each category.
        const computeSyntheticAverage = (
          key: string,
          sourceVariations: string[],
        ) => {
          const present = sourceVariations.filter((v) => variations[v]);
          if (present.length === 0) return;

          const avgSeries: HistoryVariation = {};
          for (const pm of PACKAGE_MANAGERS) {
            avgSeries[pm] = [];
            for (let i = 0; i < dates.length; i++) {
              let sum = 0;
              let count = 0;
              for (const v of present) {
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
          variations[key] = avgSeries;
        };

        // Package management average
        computeSyntheticAverage("average", [
          "clean",
          "node_modules",
          "cache",
          "cache+node_modules",
          "cache+lockfile",
          "cache+lockfile+node_modules",
          "ci",
          "lockfile",
          "lockfile+node_modules",
        ]);

        // Registry average
        computeSyntheticAverage("registryAverage", [
          "registry-clean",
          "registry-lockfile",
        ]);

        // Task-runner average
        computeSyntheticAverage("taskRunnerAverage", [
          "build",
          "build-cache",
          "run",
        ]);

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
