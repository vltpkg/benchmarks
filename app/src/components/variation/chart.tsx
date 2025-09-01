import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { createSectionId, isTaskExecutionVariation } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";

import { CHART_DEFAULTS } from "@/constants";
import { formatPackageManagerLabel, getFixtureLogo, getFixtureId } from "@/lib/utils";


import type {
  BenchmarkChartData,
  FixtureResult,
  PackageManager,
  ColorMap,
} from "@/types/chart-data";

const ClockIcon = () => (
  <svg
    data-testid="geist-icon"
    height="18"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="18"
    style={{ color: "currentcolor" }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5C11.5899 1.5 14.5 4.41015 14.5 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM8.75 4.75V4H7.25V4.75V7.875C7.25 8.18976 7.39819 8.48615 7.65 8.675L9.55 10.1L10.15 10.55L11.05 9.35L10.45 8.9L8.75 7.625V4.75Z"
      fill="currentColor"
    />
  </svg>
);

const StopwatchIcon = () => (
  <svg
    data-testid="geist-icon"
    height="18"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="18"
    style={{ color: "currentcolor" }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.35066 2.06247C5.96369 1.78847 6.62701 1.60666 7.32351 1.53473L7.16943 0.0426636C6.31208 0.1312 5.49436 0.355227 4.73858 0.693033L5.35066 2.06247ZM8.67651 1.53473C11.9481 1.87258 14.5 4.63876 14.5 8.00001C14.5 11.5899 11.5899 14.5 8.00001 14.5C4.63901 14.5 1.87298 11.9485 1.5348 8.67722L0.0427551 8.83147C0.459163 12.8594 3.86234 16 8.00001 16C12.4183 16 16 12.4183 16 8.00001C16 3.86204 12.8589 0.458666 8.83059 0.0426636L8.67651 1.53473ZM2.73972 4.18084C3.14144 3.62861 3.62803 3.14195 4.18021 2.74018L3.29768 1.52727C2.61875 2.02128 2.02064 2.61945 1.52671 3.29845L2.73972 4.18084ZM1.5348 7.32279C1.60678 6.62656 1.78856 5.96348 2.06247 5.35066L0.693033 4.73858C0.355343 5.4941 0.131354 6.31152 0.0427551 7.16854L1.5348 7.32279ZM8.75001 4.75V4H7.25001V4.75V7.875C7.25001 8.18976 7.3982 8.48615 7.65001 8.675L9.55001 10.1L10.15 10.55L11.05 9.35L10.45 8.9L8.75001 7.625V4.75Z"
      fill="currentColor"
    />
  </svg>
);

// Type definitions for chart data structures
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

  // Filter package managers based on global filter
  const filteredPackageManagers = useMemo(() =>
    packageManagers.filter(pm => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers]
  );

  // Resolve the actual theme (dark/light) when user selects "system"
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

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
      const labelWithVersion = formatPackageManagerLabel(pm, chartData.versions);
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

  const isAllSelected = selectedPackageManagers.size === filteredPackageManagers.length;

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
        if (value !== undefined && typeof value === 'number') {
          chartItem[pm] = value;
        }
      });
      fixtureMap[item.fixture] = chartItem;
    });

    return fixtureMap;
  }, [filteredVariationData, filteredPackageManagers]);

  const CustomXAxisTick = (props: { x: number; y: number; payload: { value: string } }) => {
    const { x, y, payload } = props;

    if (!payload || !payload.value) {
      return <g></g>; // Return empty group instead of null
    }

    const text = payload.value;

    // Split the text into package manager and version
    const parts = text.split(' v');
    const packageManager = parts[0];
    const version = parts[1] ? `v${parts[1]}` : '';

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
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 group">
            <ClockIcon />
            {title}
            <ShareButton
              variation={currentVariation}
              section={createSectionId(title)}
              size="sm"
              variant="ghost"
              label=""
            />
          </h3>
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
              <XAxis
                dataKey="fixture"
                tick={{
                  fontSize: 12,
                  fill: theme === 'dark' ? 'white' : 'currentColor'
                }}
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "outside",
                  style: {
                    textAnchor: "middle",
                    fill: theme === 'dark' ? 'white' : 'currentColor'
                  },
                  offset: -10,
                }}
                tickCount={CHART_DEFAULTS.TICK_COUNT}
                tick={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fill: theme === 'dark' ? 'white' : 'currentColor'
                }}
                width={80}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
              />
              <ChartLegend
                verticalAlign="bottom"
                height={60}
                wrapperStyle={{
                  color: theme === 'dark' ? 'white' : 'currentColor'
                }}
                content={(props) => {
                  if (!props.payload) return null;
                  return (
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {props.payload.map((entry, index) => {
                        const packageManager = entry.dataKey as PackageManager;
                        const isSelected = selectedPackageManagers.has(packageManager);
                        const formattedLabel = formatPackageManagerLabel(packageManager, chartData.versions);

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
                  fill={(pm === "vlt" && theme === "dark") ? "white" : colors[pm]}
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
        <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 group">
          <StopwatchIcon />
          {title}
          <ShareButton
            variation={currentVariation}
            section={createSectionId(title)}
            size="sm"
            variant="ghost"
            label=""
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
              fill: (pm === "vlt" && resolvedTheme === "dark") ? "white" : colors[pm],
            }));

          const logoSrc = getFixtureLogo(fixture as "next" | "vue" | "svelte" | "astro" | "run");

          return (
            <div
              key={fixture}
              id={getFixtureId(fixture)}
              className="bg-card rounded-xl p-6 border-[1px] border-border"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {logoSrc && (
                    <img
                      src={logoSrc}
                      alt={`${fixture} logo`}
                      className="w-6 h-6"
                    />
                  )}
                  <h4 className="text-md font-medium capitalize">{fixture} Project</h4>
                </div>
                <ShareButton
                  variation={currentVariation}
                  section={isPerPackage ? "per-package-install-time-by-fixture" : "total-install-time-by-fixture"}
                  fixture={fixture}
                  label="Share"
                  size="sm"
                  variant="ghost"
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
                      tick={<CustomXAxisTick x={0} y={0} payload={{ value: "" }} />}
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
                          fill: theme === 'dark' ? 'white' : 'currentColor'
                        },
                        offset: -10,
                      }}
                      tickCount={CHART_DEFAULTS.TICK_COUNT}
                      tick={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fill: theme === 'dark' ? 'white' : 'currentColor'
                      }}
                      width={80}
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
