import { useMemo, useState, useEffect, useId } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  getDnfGradient,
} from "@/components/ui/chart";
import { Tooltip as RechartsTooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import {
  createSectionId,
  isRegistryVariation,
  isTaskExecutionVariation,
} from "@/lib/utils";
import { resolveTheme, useTheme } from "@/components/theme-provider";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { useYAxis } from "@/contexts/y-axis-context";
import { Clock, StopWatch } from "@/components/icons";
import { YAxisToggle } from "@/components/y-axis-toggle";
import { CHART_DEFAULTS } from "@/constants";
import { formatPackageManagerLabel, getFixtureId } from "@/lib/utils";
import { getFrameworkIcon } from "@/lib/get-icons";
import { useMediaQuery } from "@/hooks/use-media-query";

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

/**
 * Standalone tooltip content for horizontal bar charts that use
 * <ResponsiveContainer> instead of <ChartContainer>. The shadcn/ui
 * ChartTooltipContent calls useChart() which requires a ChartContainer
 * context — using it outside one crashes the app.
 */
const HorizontalBarTooltipContent = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string | number;
    value?: number | string;
    color?: string;
    fill?: string;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
  }>;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const isDnf =
            item.payload?.dnf === true ||
            (typeof item.dataKey === "string" &&
              item.payload?.[`${item.dataKey}_dnf`] === true);
          // Resolve color for the indicator box. For DNF entries, use the
          // explicit dnfColor (hex) from the data row. For non-DNF entries,
          // use the data row's fill (a hex color for normal bars). We prefer
          // item.payload?.dnfColor / item.payload?.fill over item.fill /
          // item.color because Recharts derives those from the <Bar> component
          // (which has no fill prop), NOT from the <Cell> fill override.
          const color = isDnf
            ? (item.payload?.dnfColor as string) ||
              (item.payload?.fill as string) ||
              item.fill ||
              item.color
            : (item.payload?.dnfColor as string) ||
              (item.payload?.fill as string) ||
              item.fill ||
              item.color;

          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={
                  isDnf && color
                    ? { background: getDnfGradient(color) }
                    : { backgroundColor: color }
                }
              />
              <div className="flex flex-1 justify-between items-center gap-4">
                <span className="text-muted-foreground">
                  {item.name ?? item.dataKey}
                </span>
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {isDnf
                    ? "DNF"
                    : typeof item.value === "number"
                      ? item.value.toLocaleString()
                      : String(item.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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
  const isRegistry = isRegistryVariation(currentVariation);

  // Filter package managers based on global filter
  const filteredPackageManagers = useMemo(
    () => packageManagers.filter((pm) => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers],
  );

  const resolvedTheme = resolveTheme(theme);
  const showVersions = !isRegistry;
  const patternIdPrefix = useId().replace(/:/g, "");

  // Resolve display color for a package manager — vlt uses white in dark mode
  // since its brand color (#000000) is invisible on dark backgrounds
  const getColor = (pm: PackageManager) =>
    pm === "vlt" && resolvedTheme === "dark" ? "white" : colors[pm];

  const getDnfPatternId = (scope: string, pm: PackageManager) =>
    `dnf-${patternIdPrefix}-${scope}-${pm}`;

  const getDnfPatternFill = (scope: string, pm: PackageManager) =>
    `url(#${getDnfPatternId(scope, pm)})`;

  const renderDnfPatterns = (scope: string) => (
    <defs>
      {filteredPackageManagers.map((pm) => {
        const baseColor = getColor(pm);
        // In dark mode, vlt bars are white — lightening white is invisible.
        // Use a light gray background with darker gray stripes instead.
        const isWhiteBar =
          resolvedTheme === "dark" &&
          (baseColor === "white" ||
            baseColor === "#ffffff" ||
            baseColor === "#fff");
        const lightColor = isWhiteBar ? "#d1d5db" : lightenColor(baseColor);
        const stripeColor = isWhiteBar ? "#6b7280" : baseColor;
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
              stroke={stripeColor}
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
        label: formatPackageManagerLabel(
          pm,
          showVersions ? chartData.versions : undefined,
          { isRegistryVariation: isRegistry },
        ),
        color: getColor(pm),
      };
    });
    return config;
  }, [
    filteredPackageManagers,
    colors,
    chartData.versions,
    showVersions,
    isRegistry,
    resolvedTheme,
  ]);

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
            chartItem[fillKey] = getColor(pm);
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
    resolvedTheme,
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

  const isMobile = useMediaQuery("(max-width: 767px)");

  const isTaskOrRegistry =
    isTaskExecutionVariation(currentVariation) || isRegistryVariation(currentVariation);

  if (!isPerPackage && isTaskOrRegistry) {
    // Task runners & registries: horizontal bar charts per fixture, sorted by speed
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:gap-0 md:flex-row items-start md:items-center justify-between">
          <h3 className="text-base md:text-lg w-full font-medium tracking-tighter flex items-center gap-2 group">
            <Clock className="text-muted-foreground flex-shrink-0" />
            <span>{title}</span>
            <ShareButton
              variation={currentVariation}
              section={createSectionId(title)}
              size="sm"
              variant="ghost"
              className="ml-auto"
            />
          </h3>
          <div className="flex gap-2 flex-shrink-0">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredVariationData.map((fixtureResult) => {
            const fixture = fixtureResult.fixture;
            const fixtureId = getFixtureId(fixture);
            const Icon = getFrameworkIcon(fixture as Fixture);
            const slowest = fixtureSlowestValues.get(fixture);

            const barData = filteredPackageManagers
              .filter(
                (pm) =>
                  selectedPackageManagers.has(pm) &&
                  variationActivePackageManagers.has(pm),
              )
              .map((pm) => {
                const dnfKey = `${pm}_dnf` as DnfKey;
                const value = fixtureResult[pm];
                const hasNumber = typeof value === "number";
                const shouldFallback =
                  !hasNumber && typeof slowest === "number";
                const isDnf =
                  fixtureResult[dnfKey] === true || shouldFallback;
                const resolvedValue = hasNumber ? value : slowest;

                if (typeof resolvedValue !== "number") return null;

                return {
                  name: formatPackageManagerLabel(
                    pm,
                    showVersions ? chartData.versions : undefined,
                    { isRegistryVariation: isRegistry },
                  ),
                  value: resolvedValue,
                  fill: isDnf
                    ? getDnfPatternFill(fixtureId, pm)
                    : getColor(pm),
                  dnf: isDnf,
                  dnfColor: getColor(pm),
                };
              })
              .filter(Boolean)
              .sort((a, b) => (a?.value ?? 0) - (b?.value ?? 0));

            const barHeight = Math.max(barData.length * 40, 120);

            return (
              <div
                key={fixture}
                id={fixtureId}
                className="bg-card rounded-xl p-4 md:p-6 border-[1px] border-border overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    {Icon && <Icon />}
                    <h4 className="text-sm md:text-md font-medium capitalize">
                      {fixture}
                    </h4>
                  </div>
                  <ShareButton
                    variation={currentVariation}
                    section={createSectionId(title)}
                    fixture={fixture}
                    label="Share"
                    size="sm"
                    variant="ghost"
                  />
                </div>
                <div style={{ width: "100%", height: barHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{
                        top: 0,
                        right: isMobile ? 12 : 24,
                        bottom: 0,
                        left: 0,
                      }}
                    >
                      {renderDnfPatterns(fixtureId)}
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fontFamily: "var(--font-mono)",
                          fontSize: isMobile ? 10 : 12,
                          fill:
                            resolvedTheme === "dark"
                              ? "white"
                              : "currentColor",
                        }}
                        tickCount={5}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={isMobile ? 70 : 120}
                        tick={{
                          fontSize: isMobile ? 10 : 12,
                          fill:
                            resolvedTheme === "dark"
                              ? "white"
                              : "currentColor",
                        }}
                        tickFormatter={(label: string) => {
                          if (isMobile) {
                            const parts = label.split(" v");
                            return parts[0] ?? label;
                          }
                          return normalizeTickLabel(label);
                        }}
                      />
                      <RechartsTooltip
                        content={<HorizontalBarTooltipContent />}
                      />
                      <Bar dataKey="value" maxBarSize={32}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry?.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!isPerPackage) {
    // Consolidated chart for Total Install Time (package management variations)
    const consolidatedHeader = (
      <div className="flex flex-col gap-3 md:gap-0 md:flex-row items-start md:items-center justify-between">
        <h3 className="text-base md:text-lg w-full font-medium tracking-tighter flex items-center gap-2 group">
          <Clock className="text-muted-foreground flex-shrink-0" />
          <span>{title}</span>
          <ShareButton
            variation={currentVariation}
            section={createSectionId(title)}
            size="sm"
            variant="ghost"
            className="ml-auto"
          />
        </h3>
        <div className="flex gap-2 flex-shrink-0">
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
    );

    // MOBILE: Show individual fixture cards with horizontal bar charts
    if (isMobile) {
      return (
        <div className="space-y-6">
          {consolidatedHeader}

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {filteredPackageManagers.map((pm) => {
              const isSelected = selectedPackageManagers.has(pm);
              const formattedLabel = formatPackageManagerLabel(
                pm,
                showVersions ? chartData.versions : undefined,
                { isRegistryVariation: isRegistry },
              );
              return (
                <button
                  key={pm}
                  onClick={() => handleLegendClick(pm)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-md transition-all hover:bg-muted text-xs ${
                    isSelected ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getColor(pm) }}
                  />
                  <span className="font-medium">{formattedLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Individual fixture cards */}
          <div className="space-y-4">
            {filteredVariationData.map((fixtureResult) => {
              const fixture = fixtureResult.fixture;
              const fixtureId = getFixtureId(fixture);
              const Icon = getFrameworkIcon(fixture as Fixture);
              const slowest = fixtureSlowestValues.get(fixture);

              const barData = filteredPackageManagers
                .filter(
                  (pm) =>
                    selectedPackageManagers.has(pm) &&
                    variationActivePackageManagers.has(pm),
                )
                .map((pm) => {
                  const dnfKey = `${pm}_dnf` as DnfKey;
                  const value = fixtureResult[pm];
                  const hasNumber = typeof value === "number";
                  const shouldFallback =
                    !hasNumber && typeof slowest === "number";
                  const isDnf =
                    fixtureResult[dnfKey] === true || shouldFallback;
                  const resolvedValue = hasNumber ? value : slowest;

                  if (typeof resolvedValue !== "number") return null;

                  return {
                    name: formatPackageManagerLabel(
                      pm,
                      showVersions ? chartData.versions : undefined,
                      {
                        isRegistryVariation: isRegistry,
                      },
                    ),
                    value: resolvedValue,
                    fill: isDnf
                      ? getDnfPatternFill(fixtureId, pm)
                      : getColor(pm),
                    dnf: isDnf,
                    dnfColor: getColor(pm),
                    pm,
                  };
                })
                .filter(Boolean)
                .sort((a, b) => (a?.value ?? 0) - (b?.value ?? 0));

              const barHeight = Math.max(barData.length * 36, 120);

              return (
                <div
                  key={fixture}
                  id={fixtureId}
                  className="bg-card rounded-xl p-4 border-[1px] border-border overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {Icon && <Icon />}
                    <h4 className="text-sm font-medium capitalize">
                      {fixture}
                    </h4>
                  </div>
                  <div style={{ width: "100%", height: barHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                      >
                        {renderDnfPatterns(fixtureId)}
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            fill:
                              resolvedTheme === "dark"
                                ? "white"
                                : "currentColor",
                          }}
                          tickCount={5}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={70}
                          tick={{
                            fontSize: 10,
                            fill:
                              resolvedTheme === "dark"
                                ? "white"
                                : "currentColor",
                          }}
                          tickFormatter={(label: string) => {
                            // Show just the PM name on mobile, strip version
                            const parts = label.split(" v");
                            return parts[0] ?? label;
                          }}
                        />
                        <RechartsTooltip
                          content={<HorizontalBarTooltipContent />}
                        />
                        <Bar dataKey="value" maxBarSize={28}>
                          {barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry?.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // DESKTOP: Grouped bar chart (existing layout)
    return (
      <div className="space-y-8">
        {consolidatedHeader}

        <div className="bg-card rounded-xl p-3 md:p-6 border-border border-[1px] overflow-hidden">
          <ChartContainer
            config={chartConfig}
            className="min-h-[350px] md:min-h-[450px] w-full"
          >
            <BarChart data={consolidatedData}>
              {renderDnfPatterns("total")}
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="fixture"
                tick={{
                  fontSize: 12,
                  fill: resolvedTheme === "dark" ? "white" : "currentColor",
                }}
              />
              <YAxis
                label={{
                  value: yAxisLabel,
                  angle: -90,
                  position: "outside",
                  style: {
                    textAnchor: "middle",
                    fill: resolvedTheme === "dark" ? "white" : "currentColor",
                  },
                  offset: -10,
                }}
                tickCount={CHART_DEFAULTS.TICK_COUNT}
                tick={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fill: resolvedTheme === "dark" ? "white" : "currentColor",
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
                  color: resolvedTheme === "dark" ? "white" : "currentColor",
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
                          showVersions ? chartData.versions : undefined,
                          { isRegistryVariation: isRegistry },
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
                  fill={getColor(pm)}
                  name={formatPackageManagerLabel(
                    pm,
                    showVersions ? chartData.versions : undefined,
                    { isRegistryVariation: isRegistry },
                  )}
                  hide={!selectedPackageManagers.has(pm)}
                >
                  {consolidatedData.map((entry, index) => {
                    const dnfKey = `${pm}_dnf`;
                    const isDnf = entry[dnfKey] === true;
                    return (
                      <Cell
                        key={`${pm}-${entry.fixture}-${index}`}
                        fill={
                          isDnf ? getDnfPatternFill("total", pm) : getColor(pm)
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
  // Uses horizontal bar charts sorted fastest-to-slowest for all screen sizes
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

              const fillColor = getColor(pm);

              return {
                name: formatPackageManagerLabel(
                  pm,
                  showVersions ? chartData.versions : undefined,
                  { isRegistryVariation: isRegistry },
                ),
                value: resolvedValue,
                fill: isDnf ? getDnfPatternFill(fixtureId, pm) : fillColor,
                dnf: isDnf,
                dnfColor: getColor(pm),
              };
            })
            .filter(Boolean)
            .sort((a, b) => (a?.value ?? 0) - (b?.value ?? 0));

          const Icon = getFrameworkIcon(fixture as Fixture);
          const barHeight = Math.max(barChartData.length * 40, 120);

          return (
            <div
              key={fixture}
              id={fixtureId}
              className="bg-card rounded-xl p-4 md:p-6 border-[1px] border-border overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  {Icon && <Icon />}
                  <h4 className="text-sm md:text-md font-medium capitalize">
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
                />
              </div>
              <div style={{ width: "100%", height: barHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    layout="vertical"
                    margin={{
                      top: 0,
                      right: isMobile ? 12 : 24,
                      bottom: 0,
                      left: 0,
                    }}
                  >
                    {renderDnfPatterns(fixtureId)}
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{
                        fontFamily: "var(--font-mono)",
                        fontSize: isMobile ? 10 : 12,
                        fill:
                          resolvedTheme === "dark" ? "white" : "currentColor",
                      }}
                      tickCount={5}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 70 : 120}
                      tick={{
                        fontSize: isMobile ? 10 : 12,
                        fill:
                          resolvedTheme === "dark" ? "white" : "currentColor",
                      }}
                      tickFormatter={(label: string) => {
                        if (isMobile) {
                          const parts = label.split(" v");
                          return parts[0] ?? label;
                        }
                        return normalizeTickLabel(label);
                      }}
                    />
                    <RechartsTooltip
                      content={<HorizontalBarTooltipContent />}
                    />
                    <Bar dataKey="value" maxBarSize={32}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry?.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
