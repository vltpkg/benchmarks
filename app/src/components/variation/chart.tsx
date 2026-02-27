import { useMemo, useState, useEffect, useId } from "react";
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

const normalizeHexColor = (hex: string): string | null => {
  const raw = hex.replace("#", "").trim();
  if (raw.length === 3) {
    return raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }
  if (raw.length === 6) {
    return raw;
  }
  return null;
};

const lightenColor = (hex: string, amount = 0.45): string => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return hex;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");

  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
};

interface ConsolidatedChartItem {
  fixture: string;
  [packageManager: string]: string | number | boolean;
}

type DnfKey = Extract<keyof FixtureResult, `${PackageManager}_dnf`>;
type FillKey = Extract<keyof FixtureResult, `${PackageManager}_fill`>;

interface VariationChartProps {
  title: string;
  variationData: FixtureResult[];
  packageManagers: PackageManager[];
  colors: ColorMap;
  chartData: BenchmarkChartData;
  isPerPackage: boolean;
  currentVariation: string;
}

interface CustomXAxisTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string | number;
  };
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
  const patternIdPrefix = useId().replace(/:/g, "");

  const getDnfPatternId = (scope: string, pm: PackageManager) =>
    `dnf-${patternIdPrefix}-${scope}-${pm}`;

  const getDnfPatternFill = (scope: string, pm: PackageManager) =>
    `url(#${getDnfPatternId(scope, pm)})`;

  const renderDnfPatterns = (scope: string) => (
    <defs>
      {filteredPackageManagers.map((pm) => {
        const baseColor = colors[pm];
        const lightColor = lightenColor(baseColor);
        return (
          <pattern
            key={`${scope}-${pm}`}
            id={getDnfPatternId(scope, pm)}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill={lightColor} />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke={baseColor}
              strokeWidth="3"
            />
          </pattern>
        );
      })}
    </defs>
  );

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

  // Variation data already respects fixture filters upstream
  const filteredVariationData = variationData;

  const variationActivePackageManagers = useMemo(() => {
    const active = new Set<PackageManager>();

    filteredVariationData.forEach((item) => {
      filteredPackageManagers.forEach((pm) => {
        const dnfKey = `${pm}_dnf` as keyof FixtureResult;
        const value = item[pm];
        if (item[dnfKey] === true) {
          active.add(pm);
          return;
        }
        if (typeof value === "number" && value > 0) {
          active.add(pm);
        }
      });
    });

    return active;
  }, [filteredVariationData, filteredPackageManagers]);

  const fixtureSlowestValues = useMemo(() => {
    const slowestMap = new Map<string, number>();

    filteredVariationData.forEach((item) => {
      let slowest = 0;

      variationActivePackageManagers.forEach((pm) => {
        const dnfKey = `${pm}_dnf` as keyof FixtureResult;
        const value = item[pm];
        if (item[dnfKey] === true) {
          return;
        }
        if (typeof value === "number" && value > 0) {
          slowest = Math.max(slowest, value);
        }
      });

      if (slowest > 0) {
        slowestMap.set(item.fixture, slowest);
      }
    });

    return slowestMap;
  }, [filteredVariationData, variationActivePackageManagers]);

  // Always compute both data structures to avoid conditional hook calls
  const consolidatedData = useMemo(() => {
    return filteredVariationData.map((item): ConsolidatedChartItem => {
      const chartItem: ConsolidatedChartItem = { fixture: item.fixture };
      const slowest = fixtureSlowestValues.get(item.fixture);

      filteredPackageManagers.forEach((pm) => {
        const value = item[pm as keyof FixtureResult];
        const fillKey = `${pm}_fill` as FillKey;
        const dnfKey = `${pm}_dnf` as DnfKey;
        const fillValue = item[fillKey];
        const isActive = variationActivePackageManagers.has(pm);
        const hasNumber = typeof value === "number";
        const shouldFallback =
          isActive && !hasNumber && typeof slowest === "number";
        const isDnf = item[dnfKey] === true || shouldFallback;

        if (hasNumber) {
          chartItem[pm] = value as number;
        } else if (shouldFallback && typeof slowest === "number") {
          chartItem[pm] = slowest;
        }
        if (typeof fillValue === "string") {
          chartItem[fillKey] = fillValue;
        }
        if (isDnf) {
          chartItem[dnfKey] = true;
          if (typeof chartItem[fillKey] !== "string") {
            chartItem[fillKey] = colors[pm];
          }
        }
      });
      return chartItem;
    });
  }, [
    filteredVariationData,
    filteredPackageManagers,
    fixtureSlowestValues,
    variationActivePackageManagers,
    colors,
  ]);

  const normalizeTickLabel = (label: string) => {
    if (label.toLowerCase().startsWith("yarn (berry)")) {
      return label.replace(/yarn \(berry\)/i, "berry");
    }
    if (label.toLowerCase().startsWith("yarn (zpm)")) {
      return label.replace(/yarn \(zpm\)/i, "zpm");
    }
    return label;
  };

  const CustomXAxisTick = (props: CustomXAxisTickProps) => {
    const { x, y, payload } = props;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      payload?.value === undefined ||
      payload?.value === null
    ) {
      return <g></g>; // Return empty group instead of null
    }

    const text = normalizeTickLabel(String(payload.value));

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
              {renderDnfPatterns("total")}
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
                >
                  {consolidatedData.map((entry, index) => {
                    const dnfKey = `${pm}_dnf`;
                    const isDnf = entry[dnfKey] === true;
                    const fillColor =
                      pm === "vlt" && theme === "dark" ? "white" : colors[pm];
                    return (
                      <Cell
                        key={`${pm}-${entry.fixture}-${index}`}
                        fill={
                          isDnf ? getDnfPatternFill("total", pm) : fillColor
                        }
                      />
                    );
                  })}
                </Bar>
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
        {filteredVariationData.map((fixtureResult) => {
          const fixture = fixtureResult.fixture;
          const fixtureId = getFixtureId(fixture);
          const slowest = fixtureSlowestValues.get(fixture);
          const barChartData = filteredPackageManagers
            .filter((pm) => variationActivePackageManagers.has(pm))
            .map((pm) => {
              const dnfKey = `${pm}_dnf` as keyof FixtureResult;
              const value = fixtureResult[pm];
              const hasNumber = typeof value === "number";
              const shouldFallback = !hasNumber && typeof slowest === "number";
              const isDnf = fixtureResult[dnfKey] === true || shouldFallback;
              const resolvedValue = hasNumber ? value : slowest;

              if (typeof resolvedValue !== "number") {
                return null;
              }

              const fillColor =
                pm === "vlt" && resolvedTheme === "dark" ? "white" : colors[pm];

              return {
                name: formatPackageManagerLabel(pm, chartData.versions),
                value: resolvedValue,
                fill: isDnf ? getDnfPatternFill(fixtureId, pm) : fillColor,
                dnf: isDnf,
                dnfColor: colors[pm],
              };
            })
            .filter(Boolean);

          const Icon = getFrameworkIcon(fixture as Fixture);

          return (
            <div
              key={fixture}
              id={fixtureId}
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
                    {renderDnfPatterns(fixtureId)}
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={(props) => <CustomXAxisTick {...props} />}
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
                        <Cell key={`cell-${index}`} fill={entry?.fill} />
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
