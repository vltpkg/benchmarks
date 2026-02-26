import { useState, useEffect } from "react";
import { isBenchmarkChartData } from "@/types/chart-data";
import { CHART_DATA_URL, ERROR_MESSAGES } from "@/constants";
import { calculateAverageVariationData } from "@/lib/utils";
import type {
  BenchmarkChartData,
  ChartDataSet,
  FixtureResult,
  PackageManager,
  PackageManagerVersions,
  Variation,
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

  const applyDnfFallbacksToDataSet = (dataSet: ChartDataSet): ChartDataSet => {
    const updatedData: Record<string, FixtureResult[]> = {};
    const allPackageManagers = dataSet.packageManagers;

    Object.entries(dataSet.data).forEach(([variation, fixtures]) => {
      const variationPackageManagers = new Set<PackageManager>();

      fixtures.forEach((fixture) => {
        allPackageManagers.forEach((pm) => {
          const dnfKey = `${pm}_dnf` as keyof FixtureResult;
          const value = fixture[pm];
          if (fixture[dnfKey] === true) {
            variationPackageManagers.add(pm);
            return;
          }
          if (typeof value === "number" && value > 0) {
            variationPackageManagers.add(pm);
          }
        });
      });

      const activePackageManagers = allPackageManagers.filter((pm) =>
        variationPackageManagers.has(pm),
      );

      updatedData[variation] = fixtures.map((fixture) => {
        const updated: FixtureResult = { ...fixture };
        let slowest = 0;

        activePackageManagers.forEach((pm) => {
          const dnfKey = `${pm}_dnf` as keyof FixtureResult;
          const value = updated[pm];
          if (updated[dnfKey] === true) return;
          if (typeof value === "number" && value > 0) {
            slowest = Math.max(slowest, value);
          }
        });

        if (slowest <= 0) {
          return updated;
        }

        activePackageManagers.forEach((pm) => {
          const dnfKey = `${pm}_dnf` as keyof FixtureResult;
          const fillKey = `${pm}_fill` as keyof FixtureResult;
          const value = updated[pm];
          const isDnf = updated[dnfKey] === true;

          if (isDnf && typeof value === "number") {
            return;
          }

          if (typeof value !== "number" || isDnf) {
            (updated as any)[dnfKey] = true;
            (updated as any)[pm] = slowest;
            if ((updated as any)[fillKey] === undefined) {
              (updated as any)[fillKey] = dataSet.colors[pm];
            }
          }
        });

        return updated;
      });
    });

    return {
      ...dataSet,
      data: updatedData,
    };
  };

  const applyDnfFallbacks = (
    data: BenchmarkChartData,
  ): BenchmarkChartData => ({
    ...data,
    chartData: applyDnfFallbacksToDataSet(data.chartData),
    perPackageCountChartData: applyDnfFallbacksToDataSet(
      data.perPackageCountChartData,
    ),
  });

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

      const normalizedChartData = applyDnfFallbacks(chartData);

      // Calculate average data for both total and per-package
      const averageTotalData = calculateAverageVariationData(
        normalizedChartData,
        false,
      );
      const averagePerPackageData = calculateAverageVariationData(
        normalizedChartData,
        true,
      );

      // Add "average" to variations list if not already present (typesafe)
      const averageVariation: Variation = "average";
      const variations: Variation[] = chartData.chartData.variations.includes(
        averageVariation,
      )
        ? chartData.chartData.variations
        : [averageVariation, ...chartData.chartData.variations];

      // Merge registry chart data into main chart data if present
      const registryData = normalizedChartData.registryChartData;
      const registryVariations: Variation[] = registryData?.variations ?? [];
      const allVariations: Variation[] = [
        ...variations,
        ...registryVariations.filter((v) => !variations.includes(v)),
      ];

      // Merge registry data into chartData.data
      const mergedData = { ...normalizedChartData.chartData.data, average: averageTotalData };
      const mergedPerPackageData = { ...normalizedChartData.perPackageCountChartData.data, average: averagePerPackageData };
      if (registryData) {
        for (const [variation, data] of Object.entries(registryData.data)) {
          mergedData[variation as Variation] = data;
          mergedPerPackageData[variation as Variation] = data;
        }
      }

      // Merge package managers and colors for registry variations
      const allPackageManagers: PackageManager[] = [
        ...normalizedChartData.chartData.packageManagers,
        ...(registryData?.packageManagers ?? []).filter(
          (pm: PackageManager) => !normalizedChartData.chartData.packageManagers.includes(pm),
        ),
      ];
      const allColors = {
        ...normalizedChartData.chartData.colors,
        ...(registryData?.colors ?? {}),
      };

      // Combine chart data with versions and average data
      const combinedData: BenchmarkChartData = {
        ...normalizedChartData,
        versions,
        registryChartData: registryData,
        chartData: {
          ...normalizedChartData.chartData,
          variations: allVariations,
          data: mergedData,
          packageManagers: allPackageManagers,
          colors: allColors,
        },
        perPackageCountChartData: {
          ...normalizedChartData.perPackageCountChartData,
          variations: allVariations,
          data: mergedPerPackageData,
          packageManagers: allPackageManagers,
          colors: allColors,
        },
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
