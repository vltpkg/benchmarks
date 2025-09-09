import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { createSectionId, isTaskExecutionVariation } from "@/lib/utils";
import { resolveTheme, useTheme } from "@/components/theme-provider";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { useYAxis } from "@/contexts/y-axis-context";
import { Clock, StopWatch } from "@/components/icons";
import { YAxisToggle } from "@/components/y-axis-toggle";
import { CHART_DEFAULTS } from "@/constants";
import { formatPackageManagerLabel, getFixtureId } from "@/lib/utils";
import { getFrameworkIcon } from "@/lib/get-icons";

import type { ChartConfig } from "@/components/ui/chart";
import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
  ColorMap,
  Fixture,
} from "@/types/chart-data";

interface ConsolidatedChartItem {
  fixture: string;
  [packageManager: string]: string | number;
}

interface VariationChartProps {
  title: string;
  variationData: FixtureResult[];
  packageManagers: PackageManager[];
  colors: ColorMap;
  chartData: BenchmarkChartData;
  isPerPackage: boolean;
  currentVariation: string;
}

export const VariationChart = ({
  title,
  variationData,
  packageManagers,
  colors,
  chartData,
  isPerPackage,
  currentVariation,
}: VariationChartProps) => {
  const { theme } = useTheme();
  const { enabledPackageManagers } = usePackageManagerFilter();
  const { getYAxisDomain } = useYAxis();

  // Filter package managers based on global filter
  const filteredPackageManagers = useMemo(
    () => packageManagers.filter((pm) => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers],
  );

  const resolvedTheme = resolveTheme(theme);

  const [selectedPackageManagers, setSelectedPackageManagers] = useState<
    Set<string>
  >(new Set(filteredPackageManagers));

  // Update selected package managers when global filter changes
  useEffect(() => {
    setSelectedPackageManagers(new Set(filteredPackageManagers));
  }, [filteredPackageManagers]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    filteredPackageManagers.forEach((pm) => {
      config[pm] = {
        label: pm,
        color: colors[pm],
      };
    });
    return config;
  }, [filteredPackageManagers, colors]);

  const individualChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    filteredPackageManagers.forEach((pm) => {
      const labelWithVersion = formatPackageManagerLabel(
        pm,
        chartData.versions,
      );
      config[labelWithVersion] = {
        label: labelWithVersion,
        color: colors[pm],
      };
    });
    return config;
  }, [filteredPackageManagers, colors, chartData.versions]);

  const yAxisLabel = isTaskExecutionVariation(currentVariation)
    ? "Time (seconds)"
    : isPerPackage
      ? "Time (ms per package)"
      : "Time (seconds)";

  // Calculate Y-axis domain for consistent scaling
  const yAxisDomain = getYAxisDomain(
    variationData,
    filteredPackageManagers,
    chartData,
    isPerPackage,
    currentVariation,
  );

  // Create Y-axis props conditionally
  const yAxisProps = yAxisDomain
    ? { domain: yAxisDomain, allowDataOverflow: false }
    : {};

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
    setSelectedPackageManagers(new Set(filteredPackageManagers));
  };

  const isAllSelected =
    selectedPackageManagers.size === filteredPackageManagers.length;

  // Use all variation data (no fixture filtering)
  const filteredVariationData = variationData;

  // Always compute both data structures to avoid conditional hook calls
  const consolidatedData = useMemo(() => {
    return filteredVariationData.map((item): ConsolidatedChartItem => {
      const chartItem: ConsolidatedChartItem = { fixture: item.fixture };
      filteredPackageManagers.forEach((pm) => {
        const value = item[pm as keyof FixtureResult];
        if (value !== undefined) {
          chartItem[pm] = value;
        }
      });
      return chartItem;
    });
  }, [filteredVariationData, filteredPackageManagers]);

  const chartDataByFixture = useMemo(() => {
    const fixtureMap: Record<string, Record<string, number>> = {};

    filteredVariationData.forEach((item) => {
      const chartItem: Record<string, number> = {};
      filteredPackageManagers.forEach((pm) => {
        const value = item[pm as keyof FixtureResult];
        if (value !== undefined && typeof value === "number") {
          chartItem[pm] = value;
        }
      });
      fixtureMap[item.fixture] = chartItem;
    });

    return fixtureMap;
  }, [filteredVariationData, filteredPackageManagers]);

  const CustomXAxisTick = (props: {
    x: number;
    y: number;
    payload: { value: string };
  }) => {
    const { x, y, payload } = props;

    if (!payload || !payload.value) {
      return <g></g>; // Return empty group instead of null
    }

    const text = payload.value;

    // Split the text into package manager and version
    const parts = text.split(" v");
    const packageManager = parts[0] as PackageManager | undefined;
    const version = parts[1] ? `v${parts[1]}` : "";

    return (
      <g transform={`translate(${x},${y})`}>
        {/* Package manager name - bold, top line */}
        <text
          x={0}
          y={0}
          dy={6}
          textAnchor="middle"
          fill="#374151"
          fontSize="11"
          fontFamily="var(--font-mono)"
          fontWeight="bold"
        >
          {packageManager}
        </text>
        {/* Version - normal weight, bottom line */}
        {version && (
          <text
            x={0}
            y={0}
            dy={20}
            textAnchor="middle"
            fill="#6B7280"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fontWeight="normal"
          >
            {version}
          </text>
        )}
      </g>
    );
  };

  if (!isPerPackage) {
    // Consolidated chart for Total Install Time
    return (
      <div className="space-y-8">
        <div className="flex md:flex-row flex-col items-start md:items-center justify-between">
          <h3 className="text-lg w-full font-medium tracking-tighter flex md:items-center gap-2 group">
            <Clock className="text-muted-foreground" />
            <span className="-mt-1 md:mt-0">{title}</span>
            <ShareButton
              variation={currentVariation}
              section={createSectionId(title)}
              size="sm"
              variant="ghost"
              className="ml-auto"
            />
          </h3>
          <div className="flex gap-2">
            <YAxisToggle />
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
        </div>

        <div className="bg-card rounded-xl p-6 border-border border-[1px]">
          <ChartContainer config={chartConfig} className="min-h-[450px] w-full">
            <BarChart data={consolidatedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="fixture"
                tick={{
                  fontSize: 12,
                  fill: theme === "dark" ? "white" : "currentColor",
                }}
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "outside",
                  style: {
                    textAnchor: "middle",
                    fill: theme === "dark" ? "white" : "currentColor",
                  },
                  offset: -10,
                }}
                tickCount={CHART_DEFAULTS.TICK_COUNT}
                tick={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fill: theme === "dark" ? "white" : "currentColor",
                }}
                width={80}
                {...yAxisProps}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
              />
              <ChartLegend
                verticalAlign="bottom"
                height={100}
                wrapperStyle={{
                  color: theme === "dark" ? "white" : "currentColor",
                }}
                content={(props) => {
                  if (!props.payload) return null;
                  return (
                    <div className="flex flex-wrap md:justify-center gap-4 mt-4">
                      {props.payload.map((entry, index) => {
                        const packageManager = entry.dataKey as PackageManager;
                        const isSelected =
                          selectedPackageManagers.has(packageManager);
                        const formattedLabel = formatPackageManagerLabel(
                          packageManager,
                          chartData.versions,
                        );

                        return (
                          <button
                            key={String(entry.dataKey) || index}
                            onClick={() => handleLegendClick(packageManager)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-md transition-all hover:bg-muted ${
                              isSelected ? "opacity-100" : "opacity-40"
                            }`}
                          >
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm font-medium">
                              {formattedLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }}
              />
              {filteredPackageManagers.map((pm) => (
                <Bar
                  key={pm}
                  dataKey={pm}
                  fill={pm === "vlt" && theme === "dark" ? "white" : colors[pm]}
                  name={formatPackageManagerLabel(pm, chartData.versions)}
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
        <h3 className="text-lg font-medium tracking-tighter flex items-center gap-2 group">
          <StopWatch className="text-muted-foreground" />
          <span>{title}</span>
          <ShareButton
            variation={currentVariation}
            section={createSectionId(title)}
            size="sm"
            variant="ghost"
            className="ml-auto"
          />
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Object.entries(chartDataByFixture).map(([fixture, data]) => {
          const fixtureData = data as Record<string, number>;
          const barChartData = filteredPackageManagers
            .filter((pm) => fixtureData[pm] !== undefined)
            .map((pm) => ({
              name: formatPackageManagerLabel(pm, chartData.versions),
              value: fixtureData[pm],
              fill:
                pm === "vlt" && resolvedTheme === "dark" ? "white" : colors[pm],
            }));

          const Icon = getFrameworkIcon(fixture as Fixture);

          return (
            <div
              key={fixture}
              id={getFixtureId(fixture)}
              className="bg-card rounded-xl p-6 border-[1px] border-border"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {Icon && <Icon />}
                  <h4 className="text-md font-medium capitalize">
                    {fixture} Project
                  </h4>
                </div>
                <ShareButton
                  variation={currentVariation}
                  section={
                    isPerPackage
                      ? "per-package-install-time-by-fixture"
                      : "total-install-time-by-fixture"
                  }
                  fixture={fixture}
                  label="Share"
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                />
              </div>
              <div className="w-full">
                <ChartContainer
                  config={individualChartConfig}
                  className={`h-[${CHART_DEFAULTS.HEIGHT}px] w-full`}
                >
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={
                        <CustomXAxisTick x={0} y={0} payload={{ value: "" }} />
                      }
                      height={70}
                      interval={0}
                    />
                    <YAxis
                      label={{
                        value: yAxisLabel,
                        angle: -90,
                        position: "outside",
                        style: {
                          textAnchor: "middle",
                          fill: theme === "dark" ? "white" : "currentColor",
                        },
                        offset: -10,
                      }}
                      tickCount={CHART_DEFAULTS.TICK_COUNT}
                      tick={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fill: theme === "dark" ? "white" : "currentColor",
                      }}
                      width={80}
                      {...yAxisProps}
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
