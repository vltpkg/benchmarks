import { useState, useEffect } from "react";
import { isBenchmarkChartData } from "@/types/chart-data";
import { CHART_DATA_URL, ERROR_MESSAGES } from "@/constants";
import type { BenchmarkChartData } from "@/types/chart-data";

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

      const response = await fetch(CHART_DATA_URL);

      if (!response.ok) {
        throw new Error(
          `${ERROR_MESSAGES.FETCH_FAILED}: ${response.status} ${response.statusText}`,
        );
      }

      const data: unknown = await response.json();

      if (!isBenchmarkChartData(data)) {
        throw new Error(ERROR_MESSAGES.INVALID_DATA);
      }

      setChartData(data);
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

