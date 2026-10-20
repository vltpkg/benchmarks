"use client";

import * as echarts from "echarts/core";
import type { ReactNode } from "react";
import { BarChart } from "echarts/charts";
import { GridComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { useChart } from "@/components/charts-echarts-dots";
import { ChartFrame } from "@/components/report";
import { ECHARTS_RENDERERS } from "@/components/ui/echarts-chart";
import { toolColor } from "@/lib/chart-model";
import {
  EVIL_AXIS_LABEL,
  EVIL_AXIS_TEXT,
  EVIL_BORDER,
  EVIL_INK,
  EVIL_LABEL_TEXT,
  EVIL_MUTED,
  EVIL_REVEAL,
  EVIL_SPLIT_LINE,
  EVIL_TICK_DOT,
} from "@/lib/chart-style";
import { formatDuration, formatVersus } from "@/lib/findings";
import { formatMs } from "@/lib/measurements";

/* Renderers are registered by the vendored base chart, imported above. */
echarts.use([BarChart, GridComponent, MarkLineComponent, TooltipComponent]);

/**
 * The figure EvilCharts has no component that can do the job for: bars by
 * tool. (The time series is the stock EvilCharts line chart, in
 * `charts-echarts.tsx`.)
 *
 * It is ECharts options on EvilCharts' vendored base -- its renderer
 * registration and constants -- and takes every styling value from
 * `lib/chart-style.ts`, which is the stock line chart's own: the same tick
 * dots, the same dashed split lines, the same axis text, the same frame. A
 * bar chart beside a line chart is the same chart drawn with different marks.
 *
 * Why not EvilCharts' bar component: no value labels on bars, and it
 * separates stacked segments by a fixed 4px, which moved a bar's origin off
 * zero.
 *
 * COLOUR IS THE TOOL'S BRAND: `toolColor()` resolves to the `--color-tool-*`
 * custom property, given to ECharts as a `var()` string, so the browser
 * resolves it and re-resolves it on a theme change. Brand colours are not
 * mutually distinguishable (FRONTEND.md, measured), so colour is never the
 * only carrier: bars are labelled on their axis. The baseline is additionally
 * DASHED.
 *
 * Guarded by inventory 18: the SVG renderer, and a bar axis that starts at
 * zero.
 */
const RENDERER = ECHARTS_RENDERERS.svg;

export interface Named {
  readonly tool: string;
  readonly label: string;
}

/* An axis title, as the stock line chart sets its own: the axis text's size
   and colour, centred on the axis. */
const axisTitle = (name: string, gap: number) =>
  ({
    name,
    nameLocation: "middle",
    nameGap: gap,
    nameTextStyle: { color: EVIL_MUTED, fontSize: EVIL_AXIS_TEXT },
  }) as const;

/** ECharts measures text itself, so it needs the page's real font family. */
const fontOf = (el: HTMLElement): string => getComputedStyle(el).fontFamily;

const formatValue = (unit: "s" | "ms", value: number): string =>
  unit === "ms" ? `${formatMs(value)}ms` : formatDuration(value);

/*
 * EvilCharts' `stripped` bar (evilcharts.com/docs/echarts/bar-chart/static):
 * a bright cap of constant height at the bar's end, on a body dimmed to a
 * fifth of the colour. Theirs bakes the cap into a gradient sized from the
 * bar's pixel length; so does this, with the tool's `var()` colour, which a
 * gradient stop resolves as a fill does. The axis end is set here, so a
 * bar's pixel length is known before ECharts lays it out.
 */
const CAP = 3;
const niceMax = (v: number): number => {
  const p = 10 ** Math.floor(Math.log10(v));
  return (Math.ceil((v / p) * 2) / 2) * p;
};
const stripped = (color: string, value: number, max: number, pixels: number, across: boolean) => {
  const f = Math.min(0.85, CAP / Math.max(1, (value / max) * pixels));
  const dim = `color-mix(in oklab, ${color} 22%, transparent)`;
  return {
    type: "linear",
    /* From the bar's end: its right on a horizontal bar, its top on a vertical one. */
    ...(across ? { x: 1, y: 0, x2: 0, y2: 0 } : { x: 0, y: 0, x2: 0, y2: 1 }),
    colorStops: [
      { offset: 0, color },
      { offset: f, color },
      { offset: f, color: dim },
      { offset: 1, color: dim },
    ],
  };
};

/* ------------------------------------------------------------------ */
/* Bars by tool                                                        */
/* ------------------------------------------------------------------ */

export const BarFigure = ({
  bars,
  unit,
  baseline,
  reference,
  xLabel,
  yLabel,
  variant = "solid",
  legend,
}: {
  /** Fastest first. Only tools that completed every fixture -- see `meanBars`. */
  bars: readonly (Named & { readonly value: number })[];
  /* The UNIT, not a formatter: a function cannot cross into a client island. */
  unit: "s" | "ms";
  baseline: string | null;
  /**
   * The baseline's value, given rather than looked up in `bars`: the reader
   * may have hidden the baseline, and the multiples and the rule are still
   * taken against it.
   */
  reference: number | undefined;
  /** What the bars measure, and what the rows are. */
  xLabel: string;
  yLabel: string;
  variant?: "solid" | "stripped";
  legend?: ReactNode;
}) => {
  const height = bars.length * 44 + 64;

  const ref = useChart(
    (el) => {
      if (bars.length === 0) return null;
      const longest = Math.max(...bars.map((b) => b.label.length));
      const narrow = el.clientWidth < 640;
      const left = Math.min(200, longest * 7.2 + 28) + (narrow ? 0 : 22);
      const right = narrow ? 76 : 170;
      const max = niceMax(Math.max(...bars.map((b) => b.value), reference ?? 0));
      const fill = (tool: string, value: number) =>
        variant === "stripped"
          ? stripped(toolColor(tool), value, max, el.clientWidth - left - right, true)
          : toolColor(tool);
      const inst = echarts.init(el, undefined, { renderer: RENDERER, height });
      inst.setOption({
        animationDuration: EVIL_REVEAL,
        textStyle: { fontFamily: fontOf(el) },
        grid: { left, right, top: 4, bottom: 52 },
        xAxis: {
          type: "value",
          ...axisTitle(xLabel, 32),
          /* Zero-based, always. A bar's length is the number. */
          min: 0,
          max,
          axisLine: { show: false },
          axisTick: EVIL_TICK_DOT,
          splitLine: EVIL_SPLIT_LINE,
          axisLabel: {
            ...EVIL_AXIS_LABEL,
            hideOverlap: true,
            formatter: (v: number) => (v === 0 ? "0" : formatValue(unit, v)),
          },
        },
        yAxis: {
          type: "category",
          /* Not on a phone: there the row labels are already at the edge. */
          ...(narrow ? {} : axisTitle(yLabel, left - 14)),
          inverse: true,
          data: bars.map((b) => b.label),
          axisLine: { show: false },
          axisTick: { ...EVIL_TICK_DOT, alignWithLabel: true },
          axisLabel: { color: EVIL_INK, fontSize: EVIL_LABEL_TEXT, margin: 12 },
        },
        tooltip: { show: false },
        series: [
          {
            type: "bar",
            barWidth: 18,
            silent: true,
            data: bars.map((b) => ({
              value: b.value,
              itemStyle:
                b.tool === baseline
                  ? {
                      /* The baseline: its own colour, as a dashed outline. */
                      color: variant === "stripped" ? fill(b.tool, b.value) : "transparent",
                      borderColor: toolColor(b.tool),
                      borderWidth: 1.5,
                      borderType: [3, 3],
                      borderRadius: 4,
                    }
                  : { color: fill(b.tool, b.value), borderRadius: 4 },
            })),
            label: {
              show: true,
              position: "right",
              distance: 10,
              formatter: (p: { dataIndex: number }) => {
                const bar = bars[p.dataIndex];
                if (bar === undefined) return "";
                const note =
                  narrow || reference === undefined
                    ? ""
                    : bar.tool === baseline
                      ? "baseline"
                      : formatVersus(reference / bar.value);
                return `{value|${formatValue(unit, bar.value)}}  {note|${note}}`;
              },
              rich: {
                value: { color: EVIL_INK, fontSize: EVIL_LABEL_TEXT, fontWeight: 600 },
                note: { color: EVIL_MUTED, fontSize: EVIL_AXIS_TEXT },
              },
            },
            markLine:
              /* Only with the baseline's bar on screen. Hidden, its time can
                 lie beyond the axis, and a guide must not describe a rule
                 nobody can see. The multiples are still against it. */
              reference === undefined || !bars.some((b) => b.tool === baseline)
                ? undefined
                : {
                    silent: true,
                    symbol: "none",
                    animation: false,
                    label: { show: false },
                    lineStyle: { color: EVIL_BORDER, type: [3, 3], width: 1 },
                    data: [{ xAxis: reference }],
                  },
          },
        ],
      });
      return inst;
    },
    [bars, unit, baseline, reference, xLabel, yLabel, variant],
  );

  return (
    <ChartFrame legend={legend}>
      {bars.length === 0 ? (
        <p className="py-8 text-sm text-absent">No completed runs to draw.</p>
      ) : (
        <div ref={ref} style={{ height }} className="w-full" />
      )}
    </ChartFrame>
  );
};

/* ------------------------------------------------------------------ */
/* Bars by fixture, grouped                                            */
/* ------------------------------------------------------------------ */

/**
 * Every fixture's times in one chart: a group of bars per fixture, a bar per
 * tool, in the same order in every group, which is the legend's. Colour is
 * not the only carrier: the order is, and hovering a group lists it by name.
 * A tool with no time on a fixture -- not run, or a failed run -- has no bar
 * there, and the hover says which.
 */
export const GroupedBarFigure = ({
  fixtures,
  tools,
  unit,
  yLabel,
  legend,
}: {
  fixtures: readonly {
    readonly fixture: string;
    readonly label: string;
    readonly values: { readonly [tool: string]: number };
    readonly failed: readonly string[];
  }[];
  /** In the order drawn: the leaderboard's. */
  tools: readonly Named[];
  unit: "s" | "ms";
  yLabel: string;
  legend?: ReactNode;
}) => {
  const height = 380;
  const ref = useChart(
    (el) => {
      if (tools.length === 0 || fixtures.length === 0) return null;
      const name = (tool: string) => tools.find((t) => t.tool === tool)?.label ?? tool;
      const grid = { left: 64, right: 8, top: 12, bottom: 36 };
      const max = niceMax(Math.max(...fixtures.flatMap((f) => Object.values(f.values))));
      const inst = echarts.init(el, undefined, { renderer: RENDERER, height });
      inst.setOption({
        animationDuration: EVIL_REVEAL,
        textStyle: { fontFamily: fontOf(el) },
        grid,
        xAxis: {
          type: "category",
          data: fixtures.map((f) => f.label),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: EVIL_INK, fontSize: EVIL_LABEL_TEXT, margin: 14 },
        },
        yAxis: {
          type: "value",
          ...axisTitle(yLabel, 48),
          /* Zero-based, always. A bar's length is the number. */
          min: 0,
          max,
          axisLine: { show: false },
          axisTick: EVIL_TICK_DOT,
          splitLine: EVIL_SPLIT_LINE,
          axisLabel: {
            ...EVIL_AXIS_LABEL,
            formatter: (v: number) => (v === 0 ? "0" : formatValue(unit, v)),
          },
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "none" },
          /* Inside the chart: its scroll box would clip it. */
          confine: true,
          backgroundColor: "var(--popover)",
          borderColor: "var(--border)",
          textStyle: { color: "var(--popover-foreground)", fontSize: EVIL_LABEL_TEXT },
          formatter: (params: { dataIndex: number }[]) => {
            const f = fixtures[params[0]?.dataIndex ?? -1];
            if (f === undefined) return "";
            const rows = Object.entries(f.values)
              .sort(([, a], [, b]) => a - b)
              .map(
                ([tool, v]) =>
                  `<div style="display:flex;gap:16px;justify-content:space-between"><span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${toolColor(tool)}"></span>${name(tool)}</span><b>${formatValue(unit, v)}</b></div>`,
              )
              .join("");
            const failed =
              f.failed.length === 0
                ? ""
                : `<div style="margin-top:6px;color:var(--muted-foreground)">DNF: ${f.failed.map(name).join(", ")}</div>`;
            return `<div style="font-weight:600;margin-bottom:6px">${f.label}</div>${rows}${failed}`;
          },
        },
        series: tools.map((t) => ({
          type: "bar",
          name: t.label,
          barMaxWidth: 12,
          barGap: "20%",
          itemStyle: { borderRadius: [3, 3, 0, 0] },
          /* ECharts lightens a hovered bar's colour itself, and cannot lighten a `var()`: the bar vanished. */
          emphasis: { disabled: true },
          /* No time on a fixture is no bar: "-" is ECharts' empty cell. */
          data: fixtures.map((f) => {
            const v = f.values[t.tool];
            return v === undefined
              ? "-"
              : {
                  value: v,
                  itemStyle: {
                    color: stripped(
                      toolColor(t.tool),
                      v,
                      max,
                      height - grid.top - grid.bottom,
                      false,
                    ),
                  },
                };
          }),
        })),
      });
      return inst;
    },
    [fixtures, tools, unit, yLabel],
  );

  return (
    <ChartFrame legend={legend}>
      <div className="overflow-x-auto">
        <div ref={ref} style={{ height }} className="w-full min-w-[640px]" />
      </div>
    </ChartFrame>
  );
};
