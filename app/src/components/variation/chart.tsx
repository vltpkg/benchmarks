import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { CHART_DEFAULTS } from "@/constants";
import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
  ColorMap,
} from "@/types/chart-data";

// Type definitions for chart data structures
interface ConsolidatedChartItem {
  fixture: string;
  [packageManager: string]: string | number;
}

interface LegendPayloadEntry {
  dataKey: string;
  value: string;
  color: string;
  type?: string;
}

interface CustomLegendProps {
  payload?: LegendPayloadEntry[];
}

interface VariationChartProps {
  title: string;
  variationData: FixtureResult[];
  packageManagers: PackageManager[];
  colors: ColorMap;
  chartData: BenchmarkChartData;
  isPerPackage: boolean;
}

export const VariationChart = ({
  title,
  variationData,
  packageManagers,
  colors,
  isPerPackage,
}: VariationChartProps) => {
  const { theme } = useTheme();

  // Resolve the actual theme (dark/light) when user selects "system"
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  const [selectedPackageManagers, setSelectedPackageManagers] = useState<
    Set<string>
  >(new Set(packageManagers));

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    packageManagers.forEach((pm) => {
      config[pm] = {
        label: pm,
        color: colors[pm],
      };
    });
    return config;
  }, [packageManagers, colors]);

  const yAxisLabel = isPerPackage ? "Time (ms per package)" : "Time (seconds)";

  const handleLegendClick = (dataKey: string) => {
    setSelectedPackageManagers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };

  const handleReset = () => {
    setSelectedPackageManagers(new Set(packageManagers));
  };

  const isAllSelected = selectedPackageManagers.size === packageManagers.length;

  // Always compute both data structures to avoid conditional hook calls
  const consolidatedData = useMemo(() => {
    return variationData.map((item): ConsolidatedChartItem => {
      const chartItem: ConsolidatedChartItem = { fixture: item.fixture };
      packageManagers.forEach((pm) => {
        const value = item[pm as keyof FixtureResult];
        if (value !== undefined) {
          chartItem[pm] = value;
        }
      });
      return chartItem;
    });
  }, [variationData, packageManagers]);

  const chartDataByFixture = useMemo(() => {
    const fixtureMap: Record<string, Record<string, number>> = {};

    variationData.forEach((item) => {
      const chartItem: Record<string, number> = {};
      packageManagers.forEach((pm) => {
        const value = item[pm as keyof FixtureResult];
        if (value !== undefined && typeof value === 'number') {
          chartItem[pm] = value;
        }
      });
      fixtureMap[item.fixture] = chartItem;
    });

    return fixtureMap;
  }, [variationData, packageManagers]);

  const CustomLegendContent = ({ payload }: CustomLegendProps) => {
    if (!payload || !payload.length) return null;

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: LegendPayloadEntry) => {
          const isSelected = selectedPackageManagers.has(entry.dataKey);
          return (
            <button
              key={entry.dataKey}
              onClick={() => handleLegendClick(entry.dataKey)}
              className={`flex items-center gap-2 px-3 py-1 rounded-md transition-all hover:bg-muted ${
                isSelected ? "opacity-100" : "opacity-40"
              }`}
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm font-medium">{entry.value}</span>
            </button>
          );
        })}
      </div>
    );
  };

  if (!isPerPackage) {
    // Consolidated chart for Total Install Time
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <Button
            onClick={handleReset}
            disabled={isAllSelected}
            variant="outline"
            size="sm"
            className="text-xs dark:bg-neutral-800 bg-white shadow-none"
          >
            Reset Selection
          </Button>
        </div>

        <div className="bg-card rounded-xl p-6 border-border border-[1px]">
          <ChartContainer config={chartConfig} className="h-[450px] w-full">
            <BarChart data={consolidatedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fixture" />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                }}
                tickCount={CHART_DEFAULTS.TICK_COUNT}
                tick={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
              />
              <ChartLegend
                content={<CustomLegendContent />}
                verticalAlign="bottom"
                height={60}
              />
              {packageManagers.map((pm) => (
                <Bar
                  key={pm}
                  dataKey={pm}
                  fill={colors[pm]}
                  name={pm}
                  hide={!selectedPackageManagers.has(pm)}
                />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    );
  }

  // Individual charts for Per Package Install Time
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Object.entries(chartDataByFixture).map(([fixture, data]) => {
          const chartData = data as Record<string, number>;
          const barChartData = packageManagers
            .filter((pm) => chartData[pm] !== undefined)
            .map((pm) => ({
              name: pm,
              value: chartData[pm],
              fill: (pm === "vlt" && resolvedTheme === "dark") ? "white" : colors[pm],
            }));

          return (
            <div
              key={fixture}
              className="bg-card rounded-xl p-6 border-[1px] border-border"
            >
              <h4 className="text-md font-medium capitalize mb-4">{fixture}</h4>
              <div className="w-full">
                <ChartContainer
                  config={chartConfig}
                  className={`h-[${CHART_DEFAULTS.HEIGHT}px] w-full`}
                >
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      label={{
                        value: yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                      }}
                      tickCount={CHART_DEFAULTS.TICK_COUNT}
                      tick={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value">
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
