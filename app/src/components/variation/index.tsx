import { useParams, useOutletContext } from "react-router";
import { useEffect } from "react";
import { isValidVariation } from "@/types/chart-data";
import { ERROR_MESSAGES } from "@/constants";
import { VariationChart } from "@/components/variation/chart";
import { VariationTable } from "@/components/variation/table";
import { PackageCountTable } from "@/components/variation/package-count-table";
import { ProcessCountTable } from "@/components/variation/process-count-table";
import { usePackageCountData } from "@/hooks/use-package-count-data";
import { useProcessCountData } from "@/hooks/use-process-count-data";
import { useFixtureFilter } from "@/contexts/fixture-filter-context";
import {
  sortFixtures,
  createSectionId,
  scrollToSection,
  getFixtureId,
  getAvailablePackageManagers,
  getAvailablePackageManagersFromPackageCount,
  getAvailablePackageManagersFromProcessCount,
  isTaskExecutionVariation,
  isRegistryVariation,
} from "@/lib/utils";

import { HistoryChart } from "@/components/history-chart";

import type {
  BenchmarkChartData,
  Variation,
  FixtureResult,
} from "@/types/chart-data";
import type { HistoryData } from "@/types/history";

interface OutletContext {
  chartData: BenchmarkChartData;
  historyData: HistoryData | null;
}

export const VariationPage = () => {
  const { variation, section, fixture } = useParams<{
    variation: string;
    section?: string;
    fixture?: string;
  }>();
  const { chartData, historyData } = useOutletContext<OutletContext>();

  // Call hooks before any early returns to comply with Rules of Hooks
  const {
    packageCountData,
    loading: packageCountLoading,
    error: packageCountError,
  } = usePackageCountData(variation as Variation);
  const {
    processCountData,
    loading: processCountLoading,
    error: processCountError,
  } = useProcessCountData(variation as Variation);
  const { enabledFixtures } = useFixtureFilter();

  // Handle deep linking to sections and fixtures
  useEffect(() => {
    if (section && fixture) {
      // Navigate to specific fixture within a section
      const fixtureId = getFixtureId(fixture);
      const timer = setTimeout(() => {
        scrollToSection(fixtureId);
      }, 100);
      return () => clearTimeout(timer);
    } else if (section) {
      // Navigate to section
      const sectionId = createSectionId(section);
      const timer = setTimeout(() => {
        scrollToSection(sectionId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [section, fixture]);

  if (!variation || !isValidVariation(variation)) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Invalid Variation</h2>
        <p>
          {ERROR_MESSAGES.INVALID_VARIATION}: "{variation}". Please select a
          valid variation from the navigation.
        </p>
      </div>
    );
  }

  const totalVariationData = chartData.chartData.data[variation as Variation];
  const perPackageVariationData =
    chartData.perPackageCountChartData.data[variation as Variation];
  const allPackageManagers = chartData.chartData.packageManagers;
  const colors = chartData.chartData.colors;

  // Sort fixture data based on preferred order
  const sortFixtureData = (data: FixtureResult[]) => {
    if (!data) return data;

    const fixtureOrder = sortFixtures(data.map((item) => item.fixture));
    return data.sort((a, b) => {
      const indexA = fixtureOrder.indexOf(a.fixture);
      const indexB = fixtureOrder.indexOf(b.fixture);
      return indexA - indexB;
    });
  };

  const sortedTotalVariationData = sortFixtureData(totalVariationData || []);
  const sortedPerPackageVariationData = sortFixtureData(
    perPackageVariationData || [],
  );

  const filteredTotalVariationData = sortedTotalVariationData.filter((item) =>
    enabledFixtures.has(item.fixture),
  );
  const filteredPerPackageVariationData = sortedPerPackageVariationData.filter(
    (item) => enabledFixtures.has(item.fixture),
  );
  const filteredPackageCountData = packageCountData.filter((item) =>
    enabledFixtures.has(item.fixture),
  );
  const filteredProcessCountData = processCountData.filter((item) =>
    enabledFixtures.has(item.fixture),
  );

  // Filter package managers to only show those with data for this variation
  const packageManagers = getAvailablePackageManagers(
    filteredTotalVariationData,
    allPackageManagers,
  );

  // Filter package managers for package count data to only show those with actual data
  const packageCountPackageManagers =
    getAvailablePackageManagersFromPackageCount(
      filteredPackageCountData,
      allPackageManagers,
    );

  // Filter package managers for process count data to only show those with actual data
  const processCountPackageManagers =
    getAvailablePackageManagersFromProcessCount(
      filteredProcessCountData,
      allPackageManagers,
    );

  // Check if this is a task execution variation or registry variation
  const isTaskExecution = isTaskExecutionVariation(variation as string);
  const isRegistry = isRegistryVariation(variation as string);

  // For registry variations, check if per-package data actually contains
  // count fields (indicating package counts were collected). Without counts
  // the per-package data is identical to total time — don't show the section.
  const hasRegistryPerPackageData =
    isRegistry &&
    filteredPerPackageVariationData.some((fixture) =>
      packageManagers.some((pm) => {
        const countKey = `${pm}_count` as keyof FixtureResult;
        return typeof fixture[countKey] === "number";
      }),
    );

  // Dynamic titles and section IDs based on variation type
  const titles = isTaskExecution
    ? {
        totalChart: "Task Execution Time by Fixture",
        totalTable: "Task Execution Time Data",
        perPackageChart: "Task Execution Time by Fixture",
        perPackageTable: "Task Execution Time Data",
        packageCountTable: "Package Count Data",
        processCountTable: "Spawned Processes Data",
      }
    : isRegistry
      ? {
          totalChart: "Registry Install Time by Fixture",
          totalTable: "Registry Install Time Data",
          perPackageChart: "Registry Per Package Install Time by Fixture",
          perPackageTable: "Registry Per Package Install Time Data",
          packageCountTable: "Package Count Data",
          processCountTable: "Spawned Processes Data",
        }
      : {
          totalChart: "Total Install Time by Fixture",
          totalTable: "Total Install Time Data",
          perPackageChart: "Per Package Install Time by Fixture",
          perPackageTable: "Per Package Install Time Data",
          packageCountTable: "Package Count Data",
          processCountTable: "Spawned Processes Data",
        };

  // Section IDs for deep linking
  const sectionIds = {
    perPackageChart: createSectionId(titles.perPackageChart),
    totalChart: createSectionId(titles.totalChart),
    totalTable: createSectionId(titles.totalTable),
    perPackageTable: createSectionId(titles.perPackageTable),
    packageCountTable: createSectionId(titles.packageCountTable),
    processCountTable: createSectionId(titles.processCountTable),
  };

  return (
    <div className="space-y-12">
      {/* History chart - performance over time */}
      {historyData && (
        <HistoryChart
          historyData={historyData}
          currentVariation={variation}
          colors={colors}
          packageManagers={packageManagers}
          chartData={chartData}
        />
      )}

      {/* 4. Total time chart */}
      <div id={sectionIds.totalChart}>
        <VariationChart
          title={titles.totalChart}
          variationData={filteredTotalVariationData}
          packageManagers={packageManagers}
          colors={colors}
          chartData={chartData}
          isPerPackage={false}
          currentVariation={variation}
        />
      </div>

      {/* 1. Per-package fixture charts - show for PM tests and registry when data available */}
      {(!isTaskExecution && !isRegistry) || hasRegistryPerPackageData ? (
        <div id={sectionIds.perPackageChart}>
          <VariationChart
            title={titles.perPackageChart}
            variationData={filteredPerPackageVariationData}
            packageManagers={packageManagers}
            colors={colors}
            chartData={chartData}
            isPerPackage={true}
            currentVariation={variation as string}
          />
        </div>
      ) : null}

      <div className="space-y-8">
        {/* 2. Per-package fixture data table - show for PM tests and registry when data available */}
        {(!isTaskExecution && !isRegistry) || hasRegistryPerPackageData ? (
          <div id={sectionIds.perPackageTable}>
            <VariationTable
              title={titles.perPackageTable}
              variationData={filteredPerPackageVariationData}
              packageManagers={packageManagers}
              chartData={chartData}
              isPerPackage={true}
              currentVariation={variation as string}
            />
          </div>
        ) : null}

        {/* 3. Package count data table */}
        {packageCountLoading ? (
          <div className="text-center text-muted-foreground">
            Loading package count data...
          </div>
        ) : packageCountError ? (
          <div className="text-center text-destructive">
            Error loading package count data: {packageCountError}
          </div>
        ) : filteredPackageCountData.length > 0 ? (
          <div id={sectionIds.packageCountTable}>
            <PackageCountTable
              title="Package Count Data"
              description="Number of packages installed by each package manager for this variation"
              packageCountData={filteredPackageCountData}
              packageManagers={packageCountPackageManagers}
              versions={chartData.versions}
              currentVariation={variation as string}
            />
          </div>
        ) : null}

        {/* 6. Spawned processes data table */}
        {processCountLoading ? (
          <div className="text-center text-muted-foreground">
            Loading process count data...
          </div>
        ) : processCountError ? (
          <div className="text-center text-destructive">
            Error loading process count data: {processCountError}
          </div>
        ) : filteredProcessCountData.length > 0 ? (
          <div id={sectionIds.processCountTable}>
            <ProcessCountTable
              title="Spawned Processes Data"
              description="Number of processes spawned (execve calls) by each package manager during install"
              processCountData={filteredProcessCountData}
              packageManagers={processCountPackageManagers}
              versions={chartData.versions}
              currentVariation={variation as string}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-8">
        {/* 5. Total time data table */}
        <div id={sectionIds.totalTable}>
          <VariationTable
            title={titles.totalTable}
            variationData={filteredTotalVariationData}
            packageManagers={packageManagers}
            chartData={chartData}
            isPerPackage={false}
            currentVariation={variation}
          />
        </div>
      </div>
    </div>
  );
};
