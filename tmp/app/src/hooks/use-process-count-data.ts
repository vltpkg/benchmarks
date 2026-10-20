import { useState, useEffect } from "react";
import type {
  Variation,
  Fixture,
  ProcessCountData,
  ProcessCountTableRow,
} from "@/types/chart-data";
import { sortFixtures } from "@/lib/utils";

interface UseProcessCountDataReturn {
  processCountData: ProcessCountTableRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useProcessCountData = (
  variation: Variation,
): UseProcessCountDataReturn => {
  const [processCountData, setProcessCountData] = useState<
    ProcessCountTableRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fixtures: Fixture[] = sortFixtures([
    "next",
    "astro",
    "svelte",
    "vue",
    "large",
    "babylon",
    "run",
  ]);

  const fetchProcessCountData = async () => {
    try {
      setLoading(true);
      setError(null);

      const results: ProcessCountTableRow[] = [];

      for (const fixture of fixtures) {
        try {
          const url = `/latest/${fixture}-${variation}-process-count.json`;
          const response = await fetch(url);

          if (response.ok) {
            const processCounts: ProcessCountData = await response.json();
            results.push({
              fixture,
              variation,
              processCounts,
            });
          } else {
            console.warn(
              `Process count data not found for ${fixture}-${variation}`,
            );
          }
        } catch (e) {
          console.warn(
            `Failed to load process count data for ${fixture}-${variation}:`,
            e,
          );
        }
      }

      setProcessCountData(results);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Unknown error occurred";
      console.error("Error fetching process count data:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcessCountData();
  }, [variation]);

  return {
    processCountData,
    loading,
    error,
    refetch: fetchProcessCountData,
  };
};
