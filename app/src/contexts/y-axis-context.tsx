import { createContext, useContext, useState } from "react";
import { isTaskExecutionVariation } from "@/lib/utils";

import type { ReactNode } from "react";
import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
  Variation,
} from "@/types/chart-data";

interface YAxisContextValue {
  isConsistentYAxis: boolean;
  setIsConsistentYAxis: (value: boolean) => void;
  getYAxisDomain: (
    currentData: FixtureResult[],
    packageManagers: PackageManager[],
    chartData: BenchmarkChartData,
    isPerPackage: boolean,
    currentVariation: string,
  ) => [number, number] | undefined;
}

const YAxisContext = createContext<YAxisContextValue | undefined>(undefined);

interface YAxisProviderProps {
  children: ReactNode;
}

export const YAxisProvider = ({ children }: YAxisProviderProps) => {
  const [isConsistentYAxis, setIsConsistentYAxis] = useState(false);

  const getYAxisDomain = (
    _currentData: FixtureResult[],
    packageManagers: PackageManager[],
    chartData: BenchmarkChartData,
    isPerPackage: boolean,
    currentVariation: string,
  ): [number, number] | undefined => {
    if (!isConsistentYAxis || isPerPackage) {
      // Return undefined to let Recharts auto-scale
      // Only apply consistent scaling to total time charts, not per-package charts
      return undefined;
    }

    // Calculate global max across all variations for consistent Y-axis
    let globalMax = 0;

    // Only use total time data for consistent scaling (not per-package data)
    const dataSource = chartData.chartData.data;

    // Get all variations of the same category (package management vs task execution)
    const isCurrentTaskExecution = isTaskExecutionVariation(currentVariation);
    const allVariations = Object.keys(dataSource);

    // Filter variations to same category
    const relevantVariations = allVariations.filter((variation) => {
      const isVariationTaskExecution = isTaskExecutionVariation(variation);
      return isVariationTaskExecution === isCurrentTaskExecution;
    }) as Variation[];

    // Find global maximum across all relevant variations
    relevantVariations.forEach((variation) => {
      const variationData = dataSource[variation];
      if (!variationData) return;

      variationData.forEach((fixtureResult: FixtureResult) => {
        // Only consider the package managers that are currently filtered/enabled
        packageManagers.forEach((pm) => {
          const value = fixtureResult[pm];
          if (typeof value === "number" && value > 0) {
            globalMax = Math.max(globalMax, value);
          }
        });
      });
    });

    // If no valid data found, return undefined to use auto-scaling
    if (globalMax === 0) {
      return undefined;
    }

    // Add minimal padding and round to a reasonable number based on actual data
    const maxWithPadding = globalMax * 1.05; // Just 5% padding to stay close to actual data

    // Round up more conservatively to stay closer to the actual maximum
    let roundedMax;
    if (maxWithPadding <= 1) {
      roundedMax = Math.ceil(maxWithPadding * 10) / 10; // Round to nearest 0.1
    } else if (maxWithPadding <= 5) {
      roundedMax = Math.ceil(maxWithPadding * 2) / 2; // Round to nearest 0.5
    } else if (maxWithPadding <= 10) {
      roundedMax = Math.ceil(maxWithPadding); // Round to nearest 1
    } else if (maxWithPadding <= 30) {
      roundedMax = Math.ceil(maxWithPadding); // Round to nearest 1 for values up to 30
    } else {
      roundedMax = Math.ceil(maxWithPadding / 5) * 5; // Round to nearest 5 for larger values
    }

    return [0, roundedMax];
  };

  return (
    <YAxisContext.Provider
      value={{
        isConsistentYAxis,
        setIsConsistentYAxis,
        getYAxisDomain,
      }}
    >
      {children}
    </YAxisContext.Provider>
  );
};

export const useYAxis = () => {
  const context = useContext(YAxisContext);
  if (context === undefined) {
    throw new Error("useYAxis must be used within a YAxisProvider");
  }
  return context;
};
