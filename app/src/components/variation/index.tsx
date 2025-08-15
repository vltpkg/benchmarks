import { useParams, useOutletContext } from "react-router";
import { isValidVariation } from "@/types/chart-data";
import { ERROR_MESSAGES } from "@/constants";
import { VariationChart } from "@/components/variation/chart";
import { VariationTable } from "@/components/variation/table";
import { PackageCountTable } from "@/components/variation/package-count-table";
import { usePackageCountData } from "@/hooks/use-package-count-data";
import type { BenchmarkChartData, Variation } from "@/types/chart-data";

interface OutletContext {
  chartData: BenchmarkChartData;
}

export const VariationPage = () => {
  const { variation } = useParams<{ variation: string }>();
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
  const packageManagers = chartData.chartData.packageManagers;
  const colors = chartData.chartData.colors;

  return (
    <div className="space-y-12">
      <VariationChart
        title="Total Install Time by Fixture"
        variationData={totalVariationData}
        packageManagers={packageManagers}
        colors={colors}
        chartData={chartData}
        isPerPackage={false}
      />

      <VariationChart
        title="Per Package Install Time by Fixture"
        variationData={perPackageVariationData}
        packageManagers={packageManagers}
        colors={colors}
        chartData={chartData}
        isPerPackage={true}
      />

      <div className="space-y-8">
        <VariationTable
          title="Total Install Time Data"
          variationData={totalVariationData}
          packageManagers={packageManagers}
          chartData={chartData}
          isPerPackage={false}
        />

        <VariationTable
          title="Per Package Install Time Data"
          variationData={perPackageVariationData}
          packageManagers={packageManagers}
          chartData={chartData}
          isPerPackage={true}
        />

        {packageCountLoading ? (
          <div className="text-center text-muted-foreground">
            Loading package count data...
          </div>
        ) : packageCountError ? (
          <div className="text-center text-destructive">
            Error loading package count data: {packageCountError}
          </div>
        ) : packageCountData.length > 0 ? (
          <PackageCountTable
            title="Package Count Data"
            description="Number of packages installed by each package manager for this variation"
            packageCountData={packageCountData}
            packageManagers={packageManagers}
          />
        ) : null}
      </div>
    </div>
  );
};
