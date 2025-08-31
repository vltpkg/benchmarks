import { useParams, useOutletContext } from "react-router";
import { useEffect } from "react";
import { isValidVariation } from "@/types/chart-data";
import { ERROR_MESSAGES } from "@/constants";
import { VariationChart } from "@/components/variation/chart";
import { VariationTable } from "@/components/variation/table";
import { PackageCountTable } from "@/components/variation/package-count-table";
import { SectionNavigation } from "@/components/section-navigation";
import { usePackageCountData } from "@/hooks/use-package-count-data";
import type { BenchmarkChartData, Variation, FixtureResult } from "@/types/chart-data";
import { sortFixtures, createSectionId, scrollToSection, getFixtureId, getAvailablePackageManagers, getAvailablePackageManagersFromPackageCount } from "@/lib/utils";

interface OutletContext {
  chartData: BenchmarkChartData;
}

export const VariationPage = () => {
  const { variation, section, fixture } = useParams<{
    variation: string;
    section?: string;
    fixture?: string;
  }>();
  const { chartData } = useOutletContext<OutletContext>();

  // Call hooks before any early returns to comply with Rules of Hooks
  const {
    packageCountData,
    loading: packageCountLoading,
    error: packageCountError,
  } = usePackageCountData(variation as Variation);

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

    // Filter package managers to only show those with data for this variation
  const packageManagers = getAvailablePackageManagers(
    totalVariationData || [],
    allPackageManagers
  );

  // Filter package managers for package count data to only show those with actual data
  const packageCountPackageManagers = getAvailablePackageManagersFromPackageCount(
    packageCountData,
    allPackageManagers
  );



  // Sort fixture data based on preferred order
  const sortFixtureData = (data: FixtureResult[]) => {
    if (!data) return data;

    const fixtureOrder = sortFixtures(data.map(item => item.fixture));
    return data.sort((a, b) => {
      const indexA = fixtureOrder.indexOf(a.fixture);
      const indexB = fixtureOrder.indexOf(b.fixture);
      return indexA - indexB;
    });
  };

  const sortedTotalVariationData = sortFixtureData(totalVariationData);
  const sortedPerPackageVariationData = sortFixtureData(perPackageVariationData);

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

  // Section IDs for deep linking
  const sectionIds = {
    perPackageChart: createSectionId("Per Package Install Time by Fixture"),
    totalChart: createSectionId("Total Install Time by Fixture"),
    totalTable: createSectionId("Total Install Time Data"),
    perPackageTable: createSectionId("Per Package Install Time Data"),
    packageCountTable: createSectionId("Package Count Data"),
  };

    return (
    <div className="space-y-12">
      {/* 1. Per-package fixture charts */}
      <div id={sectionIds.perPackageChart}>
        <VariationChart
          title="Per Package Install Time by Fixture"
          variationData={sortedPerPackageVariationData}
          packageManagers={packageManagers}
          colors={colors}
          chartData={chartData}
          isPerPackage={true}
          currentVariation={variation as string}
        />
      </div>

      <div className="space-y-8">
        {/* 2. Per-package fixture data table */}
        <div id={sectionIds.perPackageTable}>
          <VariationTable
            title="Per Package Install Time Data"
            variationData={sortedPerPackageVariationData}
            packageManagers={packageManagers}
            chartData={chartData}
            isPerPackage={true}
            currentVariation={variation as string}
          />
        </div>

        {/* 3. Package count data table */}
        {packageCountLoading ? (
          <div className="text-center text-muted-foreground">
            Loading package count data...
          </div>
        ) : packageCountError ? (
          <div className="text-center text-destructive">
            Error loading package count data: {packageCountError}
          </div>
        ) : packageCountData.length > 0 ? (
          <div id={sectionIds.packageCountTable}>
            <PackageCountTable
              title="Package Count Data"
              description="Number of packages installed by each package manager for this variation"
              packageCountData={packageCountData}
              packageManagers={packageCountPackageManagers}
              versions={chartData.versions}
              currentVariation={variation as string}
            />
          </div>
        ) : null}
      </div>

      {/* 4. Total install time chart */}
      <div id={sectionIds.totalChart}>
        <VariationChart
          title="Total Install Time by Fixture"
          variationData={sortedTotalVariationData}
          packageManagers={packageManagers}
          colors={colors}
          chartData={chartData}
          isPerPackage={false}
          currentVariation={variation as string}
        />
      </div>

      <div className="space-y-8">
        {/* 5. Total install time data table */}
        <div id={sectionIds.totalTable}>
          <VariationTable
            title="Total Install Time Data"
            variationData={sortedTotalVariationData}
            packageManagers={packageManagers}
            chartData={chartData}
            isPerPackage={false}
            currentVariation={variation as string}
          />
        </div>
      </div>
    </div>
  );
};
