import { useState, useEffect } from "react";
import { isBenchmarkChartData } from "@/types/chart-data";
import { CHART_DATA_URL, ERROR_MESSAGES } from "@/constants";
import type {
  BenchmarkChartData,
  PackageManagerVersions,
} from "@/types/chart-data";

interface UseChartDataReturn {
  chartData: BenchmarkChartData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useChartData = (): UseChartDataReturn => {
  const [chartData, setChartData] = useState<BenchmarkChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch chart data
      const chartResponse = await fetch(CHART_DATA_URL);

      if (!chartResponse.ok) {
        throw new Error(
          `${ERROR_MESSAGES.FETCH_FAILED}: ${chartResponse.status} ${chartResponse.statusText}`,
        );
      }

      const chartData: unknown = await chartResponse.json();

      if (!isBenchmarkChartData(chartData)) {
        throw new Error(ERROR_MESSAGES.INVALID_DATA);
      }

      // Fetch versions data (optional)
      let versions: PackageManagerVersions | undefined;
      if (chartData.versions) {
        versions = chartData.versions;
      } else {
        console.warn("Versions data not available");
      }

      // Combine chart data with versions
      const combinedData: BenchmarkChartData = {
        ...chartData,
        versions,
      };

      setChartData(combinedData);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Unknown error occurred";
      console.error("Error fetching chart data:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  return {
    chartData,
    loading,
    error,
    refetch: fetchChartData,
  };
};
