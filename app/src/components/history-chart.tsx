import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { resolveTheme, useTheme } from "@/components/theme-provider";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatPackageManagerLabel, isRegistryVariation, isTaskExecutionVariation } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";

import type { ChartConfig } from "@/components/ui/chart";
import type { HistoryData, HistoryDataPoint } from "@/types/history";
import type {
  BenchmarkChartData,
  ColorMap,
  PackageManager,
} from "@/types/chart-data";

const RANGE_OPTIONS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "All", days: Infinity },
] as const;

interface HistoryChartProps {
  historyData: HistoryData;
  currentVariation: string;
  colors: ColorMap;
  packageManagers: PackageManager[];
  chartData: BenchmarkChartData;
}

export const HistoryChart = ({
  historyData,
  currentVariation,
  colors,
  packageManagers,
  chartData,
}: HistoryChartProps) => {
  const { theme } = useTheme();
  const resolvedTheme = resolveTheme(theme);
  const { enabledPackageManagers } = usePackageManagerFilter();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [range, setRange] = useState<number>(90);
  const isRegistry = isRegistryVariation(currentVariation);
  const isTaskExecution = isTaskExecutionVariation(currentVariation);
  // Package-management variations now use per-package data (ms/pkg);
  // registry and task-runner variations still use total time (seconds).
  const isPerPackageVariation = !isRegistry && !isTaskExecution;

  const variationData = historyData.variations[currentVariation];

  const filteredPMs = useMemo(
    () => packageManagers.filter((pm) => enabledPackageManagers.has(pm)),
    [packageManagers, enabledPackageManagers],
  );

  const [selectedPMs, setSelectedPMs] = useState<Set<string>>(
    new Set(filteredPMs),
  );

  // Sync selection when global PM filter changes
  useEffect(() => {
    setSelectedPMs(new Set(filteredPMs));
  }, [filteredPMs]);

  const getColor = (pm: PackageManager) =>
    pm === "vlt" && resolvedTheme === "dark" ? "white" : colors[pm];

  const handleLegendClick = (pm: string) => {
    setSelectedPMs((prev) => {
      const next = new Set(prev);
      if (next.has(pm)) {
        next.delete(pm);
      } else {
        next.add(pm);
      }
      return next;
    });
  };

  const handleReset = () => {
    setSelectedPMs(new Set(filteredPMs));
  };

  const isAllSelected = selectedPMs.size === filteredPMs.length;

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    filteredPMs.forEach((pm) => {
      config[pm] = {
        label: formatPackageManagerLabel(
          pm,
          chartData.versions,
          { isRegistryVariation: isRegistry },
        ),
        color: getColor(pm),
      };
    });
    return config;
  }, [filteredPMs, colors, resolvedTheme, chartData.versions, isRegistry]);

  const chartDataPoints = useMemo((): HistoryDataPoint[] => {
    if (!variationData) return [];

    const { dates } = historyData;
    const startIdx =
      range === Infinity ? 0 : Math.max(0, dates.length - range);

    const points: HistoryDataPoint[] = [];
    for (let i = startIdx; i < dates.length; i++) {
      const point: HistoryDataPoint = { date: dates[i] };
      let hasAny = false;

      for (const pm of filteredPMs) {
        const series = variationData[pm];
        if (series && series[i] !== null && series[i] !== undefined) {
          point[pm] = series[i];
          hasAny = true;
        }
      }

      if (hasAny) {
        points.push(point);
      }
    }

    return points;
  }, [historyData, variationData, filteredPMs, range]);

  if (!variationData || chartDataPoints.length < 2) {
    return null;
  }

  const formatDateTick = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), isMobile ? "M/d" : "MMM d");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:gap-0 md:flex-row items-start md:items-center justify-between">
        <h3 className="text-base md:text-lg w-full font-medium tracking-tighter flex items-center gap-2">
          <TrendingUp className="size-5 text-muted-foreground flex-shrink-0" />
          <span>Performance Over Time</span>
        </h3>
        <div className="flex gap-1 flex-shrink-0">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              size="sm"
              variant="outline"
              onClick={() => setRange(opt.days)}
              className={`text-xs shadow-none ${
                range === opt.days
                  ? "bg-black text-white hover:bg-black hover:text-white dark:bg-white dark:text-black dark:hover:bg-white dark:hover:text-black"
                  : "dark:bg-neutral-800 bg-white"
              }`}
            >
              {opt.label}
            </Button>
          ))}
          <Button
            onClick={handleReset}
            disabled={isAllSelected}
            variant="outline"
            size="sm"
            className="text-xs dark:bg-neutral-800 bg-white shadow-none ml-2"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl p-3 md:p-6 border-border border-[1px] overflow-hidden">
        <ChartContainer
          config={chartConfig}
          className="min-h-[180px] md:min-h-[250px] w-full"
        >
          <LineChart data={chartDataPoints}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateTick}
              tick={{
                fontSize: isMobile ? 10 : 12,
                fill: resolvedTheme === "dark" ? "white" : "currentColor",
              }}
              interval="preserveStartEnd"
              minTickGap={isMobile ? 40 : 60}
            />
            <YAxis
              label={{
                value: isPerPackageVariation ? "Time (ms/pkg)" : "Time (seconds)",
                angle: -90,
                position: "outside",
                style: {
                  textAnchor: "middle",
                  fill: resolvedTheme === "dark" ? "white" : "currentColor",
                },
                offset: -10,
              }}
              tick={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fill: resolvedTheme === "dark" ? "white" : "currentColor",
              }}
              width={80}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => {
                    try {
                      return format(parseISO(String(label)), "MMM d, yyyy");
                    } catch {
                      return String(label);
                    }
                  }}
                  formatter={(value, name) => (
                    <div className="flex flex-1 justify-between items-center gap-4">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {typeof value === "number"
                          ? isPerPackageVariation
                            ? `${value.toFixed(1)} ms/pkg`
                            : `${value.toFixed(2)}s`
                          : String(value)}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {filteredPMs.map((pm) => (
              <Line
                key={pm}
                type="monotone"
                dataKey={pm}
                stroke={getColor(pm)}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={!selectedPMs.has(pm)}
                name={formatPackageManagerLabel(
                  pm,
                  chartData.versions,
                  { isRegistryVariation: isRegistry },
                )}
              />
            ))}
          </LineChart>
        </ChartContainer>

        {/* Clickable legend — matches bar chart style */}
        <div className="flex flex-wrap md:justify-center gap-3 md:gap-4 mt-4">
          {filteredPMs.map((pm) => {
            const series = variationData[pm];
            const hasData =
              series && series.some((v) => v !== null && v !== undefined);
            if (!hasData) return null;

            const isSelected = selectedPMs.has(pm);
            const formattedLabel = formatPackageManagerLabel(
              pm,
              chartData.versions,
              { isRegistryVariation: isRegistry },
            );

            return (
              <button
                key={pm}
                onClick={() => handleLegendClick(pm)}
                className={`flex items-center gap-2 px-3 py-1 rounded-md transition-all hover:bg-muted text-sm ${
                  isSelected ? "opacity-100" : "opacity-40"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getColor(pm) }}
                />
                <span className="font-medium">{formattedLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
