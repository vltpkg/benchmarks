"use client";

import * as echarts from "echarts/core";
import {
  ChevronDown,
  CircleX,
  Ruler,
  SlidersHorizontal,
  Tag,
  TriangleAlert,
  X,
  ZoomOut,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useQueryStates } from "nuqs";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as Pointer,
  type ReactNode,
} from "react";
import { ChartLegend } from "@/components/chart-legend";
import { PinnedRun, type PinnedNote, type TrendDetail } from "@/components/pinned-run";
import { RangePicker } from "@/components/range-picker";
import { usePending } from "@/components/report-pending";
import { Callout, ChartFrame, Figure } from "@/components/report";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChartConfig } from "@/components/ui/echarts-chart";
import { EChartsLineChart } from "@/components/ui/echarts-line-chart";
import {
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "@/components/ui/echarts-tooltip";
import { toolColor } from "@/lib/chart-model";
import { EVIL_AXIS_LABEL, EVIL_SPLIT_LINE, EVIL_TICK_DOT, escapeHtml } from "@/lib/chart-style";
import {
  bridges,
  flagOutliers,
  loneRuns,
  metricRows,
  nearestRun,
  rollingMedian,
  stepChange,
  type Metric,
} from "@/lib/figures";
import { formatDuration } from "@/lib/findings";
import { reportParams } from "@/lib/params";
import type { SectionId } from "@/lib/sections";
import { formatValueRange, parseValueRange } from "@/lib/value-range";
import { versionNote, type DatedVersions, type VersionMarker } from "@/lib/version-markers";

/**
 * THE time-series chart: the report's "Performance over time". There was
 * once a second, a look-alike built from raw ECharts options beside the stock
 * EvilCharts one, and the two drifted apart; this is the only one.
 *
 * The plot is EvilCharts' vendored line chart (`ui/echarts-line-chart.tsx`),
 * WHOLE, configured as its own example is
 * (evilcharts.com/docs/echarts/line-chart/static) except for its resting
 * dots: plain lines, a "border" dot on hover, clickable lines, the
 * left-to-right draw-in. A dot at every run was a field of dots; the only
 * resting marks are a solid dot on a run with no neighbour and a ring where
 * a tool's version changed (see `lone` and `changed` below). Its grid, axes
 * and tooltip surface are its own. The value axis has a title; the date axis
 * does not need one.
 *
 * What this component owns around it:
 *
 *   the frame      one rounded border, the same container the tables use
 *   title          (`Figure`); nothing is written under it
 *   controls       the date range (presets and a calendar) and the scale,
 *                  two outline menus in the container's top row beside the
 *                  tab, through `range`/`from`/`to` and `scale`
 *   versions       on the plot: a ring on a tool's line at the run where its
 *                  version changed, and in the tooltip every tool's version
 *                  on the hovered date, the changes written out
 *   the pin        a click on the plot pins the nearest run (`at`): a rule,
 *                  a dot on each line, and that run's values in the legend
 *   the brush      EvilCharts' own, directly under the plot and on its x
 *                  extent. Narrowing it and letting go makes its window the
 *                  page's `from`/`to` (linked brushing, below)
 *   value zoom     `y`: a vertical drag on the axis-label strip zooms the
 *                  value axis to the band dragged (`lo~hi`, in the metric's
 *                  units); Display > Value range > "Fit to shown tools"
 *                  (`fit`) lets the axis leave zero, so hiding the slow tools
 *                  zooms in. "Reset zoom" in the controls row undoes either;
 *                  a new metric drops it. Marks off the zoomed axis are not
 *                  drawn, and the axis title says "zoomed"
 *   the legend     in the frame's footer: mark, colour, name, latest value,
 *                  each entry toggling its tool through `hide`
 *
 * Props are serialisable data and config only. Data is fetched and shaped on
 * the server; nothing honest is decided here.
 *
 * `renderer="svg"`. The vendored component defaults to CANVAS, and canvas is
 * not inspectable, not assertable from a test, and not reachable by assistive
 * technology.
 *
 * FOUR THINGS THE STOCK CHART CANNOT DO, and how each is handled without
 * editing the vendored file:
 *
 * 1. A LOG AXIS, AND A ZOOMED ONE. It has neither option, and its
 *    `chartOptions` escape hatch is a shallow merge, so either means
 *    supplying a whole `yAxis`. The one supplied here copies the component's
 *    own axis styling value for value (`lib/chart-style.ts`, taken from its
 *    `buildMainAxes`) and changes only `type` -- for the plot and for the
 *    brush's miniature alike -- and, on the plot's axis only, its ends. It
 *    is supplied ONLY in log mode or when zoomed; an unzoomed linear axis is
 *    the stock axis, untouched.
 * 2. A TOOLTIP THAT KNOWS THE UNIT. The stock one prints the raw number
 *    ("1.643"). The replacement is built from the component's own exported
 *    pieces -- its option base, shell, row and indicator -- so the surface is
 *    identical and only the value text differs.
 * 3. REPAINTING ON A THEME CHANGE. It re-reads colours when the `class`
 *    attribute changes; this app switches `data-theme`. The chart is keyed on
 *    the resolved theme, so it remounts and re-reads. Handled here once, for
 *    every time-series chart.
 * 4. A CLICK ON THE PLOT, AND A RULE THAT STAYS. It exposes neither its
 *    ECharts instance nor a reference line. The instance is looked up from
 *    its DOM node (`getInstanceByDom`) to hear clicks and to place the rule,
 *    which is an element of ours laid over the plot, as are the version
 *    rings and the pinned run's dots: as series symbols ECharts thins them
 *    to the labelled ticks whenever the axis is short of room.
 *
 * WHAT WAS GIVEN UP to keep this look, deliberately: labels at the ends of
 * the lines, and axis text larger than the component's 10px. Neither can be
 * added through `chartOptions` without replacing the series or axes the
 * component builds. The legend carries each tool's latest value.
 */
const RENDERER = "svg" as const;

/** One stroke weight for every tool. */
const STROKE = 1.5;

const PLOT = "h-[320px] w-full sm:h-[420px] lg:h-[520px]";

/* A marker-only series beside a tool's line, for its runs with no neighbour. */
const LONE = "__lone";
/* A tool's rolling median, drawn over its line when smoothing is on. */
const SMOOTH = "__smooth";
/* Dotted bridges over a tool's holes, when asked for: two series, the holes in turn (`bridges`). */
const BRIDGE = ["__bridge0", "__bridge1"] as const;
const GAP = "color-mix(in oklab, var(--muted-foreground) 70%, transparent)";

/** "2026-10-05" as "Oct 5". Read from the string: no time zone to get wrong. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (iso: string): string => {
  const [, month, day] = iso.split("-").map(Number);
  const name = MONTHS[(month ?? 0) - 1];
  return name === undefined || day === undefined ? iso : `${name} ${day}`;
};

const METRIC_ORDER: readonly Metric[] = ["total", "change", "baseline", "per-package"];
export const METRIC_LABELS: { readonly [M in Metric]: string } = {
  total: "Total time",
  change: "Change since start",
  baseline: "Relative to baseline",
  "per-package": "Per package (ms/pkg)",
};

/** The mark a derived metric carries wherever it is chosen or drawn. */
const Derived = () => (
  <span className="rounded-sm border px-1 font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase">
    Derived
  </span>
);

export interface TimeSeriesTool {
  readonly tool: string;
  readonly label: string;
}

export const TimeSeriesChart = ({
  id,
  title,
  rows,
  tools,
  section,
  baseline,
  window,
  yLabel,
  markers = [],
  versions = [],
  trend = [],
  perPackage = true,
  focus = null,
  fixedMetric,
  scope,
  tabs,
  firstTabActive,
}: {
  id: string;
  title: string;
  /** Always this metric, with no menu for it: a figure that is about one (per package, by fixture). */
  fixedMetric?: Metric;
  /**
   * A prefix for the chart's own view in the URL -- scale, pin, zoom,
   * smoothing, gaps -- so a second chart on the page keeps its own. The
   * window, the hidden tools, the exclusions and the focus stay the page's.
   */
  scope?: string;
  /** A tab row in place of the title tab (`FigureTabStrip`). */
  tabs?: ReactNode;
  firstTabActive?: boolean;
  /** Dense rows from `toDenseChartRows`: holes as `null`, never as zero. */
  rows: readonly { date: string; [tool: string]: string | number | null }[];
  /** Every tool these files contain, in ranking order -- hidden ones included. */
  tools: readonly TimeSeriesTool[];
  section: SectionId;
  baseline: string | null;
  /**
   * Version changes to mark on the plot, and each date's versions for the
   * tooltip. Both empty where the keys do not name clients (registries).
   */
  markers?: readonly VersionMarker[];
  versions?: readonly DatedVersions[];
  /** What the value axis measures, in words: quantity, and over what. */
  yLabel: string;
  /**
   * Each run's coverage, failures, spread and per-fixture seconds (from
   * `loadScenario`), for the DNF marks, the band, the tooltip and the pinned
   * run's panel.
   */
  trend?: readonly TrendDetail[];
  /**
   * Whether "Per package" can be offered: there are package counts for what
   * is plotted. Not for task runners: nothing is installed.
   */
  perPackage?: boolean;
  /** The brush's focus inside the loaded window (`?focus=`), as the server resolved it. */
  focus?: { readonly from: string; readonly to: string } | null;
  /** The window in effect and what may be chosen, for the range picker. */
  window: {
    readonly dates: readonly string[];
    readonly end: string;
    readonly from: string;
    readonly to: string;
    readonly custom: boolean;
  };
}) => {
  const { resolvedTheme } = useTheme();
  /* Server writes run in the report's transitions; a tools change leaves the lines live. */
  const { data: reloading, startTransition, startToolsTransition } = usePending();
  /* Reloading what is plotted: EvilCharts' own wave, with our marks off it. Under
     reduced motion the region's still tint alone. */
  const reduced = useReducedMotion() === true;
  const loading = reloading && !reduced;
  /*
   * `hide` is the page's one tools filter -- the tools menu writes the same
   * parameter -- and the server shapes the tables and bars from it, so that
   * write is not shallow. The chart itself redraws at once from the new
   * state; it does not wait for the server. `scale` and `at` are the chart's
   * alone.
   */
  const [
    { hide, scale, at, metric: chosen, smooth, gaps, exclude, y, focus: focusParam },
    setParams,
  ] = useQueryStates(
    {
      hide: { ...reportParams.hide, shallow: false, startTransition: startToolsTransition },
      scale: reportParams.scale,
      gaps: reportParams.gaps,
      at: reportParams.at,
      smooth: reportParams.smooth,
      y: reportParams.y,
      /* Server: these change what is loaded, or what every trend on the page
       is computed from. */
      metric: { ...reportParams.metric, shallow: false, startTransition },
      exclude: { ...reportParams.exclude, shallow: false, startTransition },
      from: { ...reportParams.from, shallow: false, startTransition },
      to: { ...reportParams.to, shallow: false, startTransition },
      date: { ...reportParams.date, shallow: false, startTransition },
      /* The focus reshapes the page's other trends, not this chart's data: the
       tools transition, which leaves the chart live rather than loading. */
      focus: { ...reportParams.focus, shallow: false, startTransition: startToolsTransition },
    },
    scope === undefined
      ? {}
      : {
          urlKeys: Object.fromEntries(
            ["scale", "at", "smooth", "gaps", "y"].map((k) => [k, `${scope}-${k}`]),
          ),
        },
  );
  /* A metric this chart cannot draw is read as the measurement. */
  const metric = fixedMetric ?? (chosen === "per-package" && !perPackage ? "total" : chosen);
  /* A percentage change crosses zero; a log axis cannot hold it. */
  const axis = metric === "change" ? "linear" : scale;
  /* The value-axis zoom; one a log axis cannot hold is no zoom. */
  const range = parseValueRange(y, axis === "log");

  /* A name in the URL that these files do not contain hides nothing. */
  const hidden = hide.filter((tool) => tools.some((t) => t.tool === tool));
  const shown = tools.filter((t) => !hidden.includes(t.tool));

  const cell = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const keys = tools.map((t) => t.tool);
  const baselineLabel = tools.find((t) => t.tool === baseline)?.label ?? null;
  /* What is drawn: the rows under the chosen metric. */
  const plotted = useMemo(
    () => metricRows(rows, keys, metric, baseline),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, metric, baseline, keys.join(",")],
  );
  const fmt = (v: number): string =>
    metric === "change"
      ? `${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}%`
      : metric === "baseline"
        ? `${v.toFixed(v < 10 ? 2 : 1)}×`
        : metric === "per-package"
          ? `${v.toFixed(v < 10 ? 2 : 1)}ms/pkg`
          : formatDuration(v);
  const derived = metric !== "total";
  const detailOn = useMemo(() => new Map(trend.map((d) => [d.date, d])), [trend]);

  /*
   * The pinned run. A date with no row here, or a day nothing ran, pins
   * nothing -- a stale or hand-written `at` is ignored, not drawn as a rule
   * over an empty day.
   */
  const ran = rows.map((r) => tools.some((t) => cell(r[t.tool]) !== null));
  const pin = at === null ? -1 : rows.findIndex((r, i) => r.date === at && ran[i]);

  /** Each tool's value on the last run in range that it has one for. */
  const latest = (tool: string): number | null => {
    for (let i = plotted.length - 1; i >= 0; i--) {
      const value = cell(plotted[i]?.[tool]);
      if (value !== null) return value;
    }
    return null;
  };

  /*
   * Colour lives in the config, not on <Line>, and in the shape the vendored
   * chart reads: `colors: { light: [...] }`. This passed `color: "..."` for
   * most of its life. The chart has no such field, ignored it without a word,
   * and fell back to its grey for every series. Defect 6's shape again: an
   * interface that accepts a value it does not use.
   *
   * One slot, under `light` only. The vendored chart scopes its dark slot to
   * a `.dark` class this app never sets; the values are theme-switching
   * custom properties, so the one slot is right in both schemes.
   */
  const paint = (tool: string): string => toolColor(tool);

  /*
   * NO POINT MARKERS on the lines: ten lines of thirty dots is a field of
   * dots. But a line with no markers draws a run only as part of a segment,
   * and a run with a hole on both sides has no segment -- it would simply not
   * be drawn. So each tool that has such runs gets a second, marker-only
   * series holding just those (`loneRuns`), in the same colour. Nothing
   * published is dropped from the plot.
   */
  const lone = useMemo(() => {
    const flags = new Map<string, boolean[]>();
    for (const { tool } of shown) {
      const marks = loneRuns(plotted.map((r) => cell(r[tool])));
      if (marks.some(Boolean)) flags.set(tool, marks);
    }
    return flags;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotted, shown.map((t) => t.tool).join(",")]);

  /*
   * SMOOTHING draws a rolling median (three runs either side) over each tool,
   * and thins the raw line under it rather than removing it: the median is a
   * reading aid, the runs are the measurement.
   */
  const smoothed = smooth === "median7";
  /* GAPS: a hole by default; on request, a dotted bridge over it -- its own series, never the line. */
  const bridged = gaps === "connect";
  const data = useMemo(
    () => {
      const medians = smoothed
        ? new Map(shown.map(({ tool }) => [tool, rollingMedian(plotted.map((r) => cell(r[tool])))]))
        : null;
      const spans = bridged
        ? new Map(shown.map(({ tool }) => [tool, bridges(plotted.map((r) => cell(r[tool])))]))
        : null;
      return plotted.map((row, i) => {
        const out: Record<string, unknown> = { ...row };
        for (const [tool, marks] of lone) out[`${tool}${LONE}`] = marks[i] ? row[tool] : null;
        if (medians !== null)
          for (const [tool, m] of medians) out[`${tool}${SMOOTH}`] = m[i] ?? null;
        if (spans !== null)
          for (const [tool, pair] of spans)
            BRIDGE.forEach((key, k) => (out[`${tool}${key}`] = pair[k]?.[i] ?? null));
        return out;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plotted, lone, smoothed, bridged, shown.map((t) => t.tool).join(",")],
  );

  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        shown.flatMap(({ tool, label }) => [
          [tool, { label, colors: { light: [paint(tool)] } }],
          ...(lone.has(tool)
            ? [[`${tool}${LONE}`, { label, colors: { light: [paint(tool)] } }]]
            : []),
          ...(smoothed ? [[`${tool}${SMOOTH}`, { label, colors: { light: [paint(tool)] } }]] : []),
          /* Grey, not the tool's: a bridge is the absence of a run, and must not read as one. */
          ...(bridged
            ? BRIDGE.map((key) => [`${tool}${key}`, { label, colors: { light: [GAP] } }])
            : []),
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown.map((t) => t.tool).join(","), lone, smoothed, bridged],
  );

  /*
   * VERSION CHANGES ARE ON THE PLOT: a ring on a tool's line at the run where
   * its version changed. They were a list of thirty rows under the chart,
   * which nobody could hold against the lines. The ring says where; the
   * tooltip says what. The pinned run's dots are the same kind of mark.
   *
   * These are elements of ours laid over the plot, not series symbols. As
   * symbols they were dropped wherever the axis ran short of room -- ECharts
   * thins a series' symbols to the labelled ticks -- so at phone width most
   * of the rings, and every pinned dot off a tick, were simply not drawn.
   */
  const changed = useMemo(() => new Map(markers.map((m) => [`${m.tool} ${m.date}`, m])), [markers]);
  /*
   * Runs far from their neighbours (`flagOutliers`), judged on the measured
   * seconds whatever the metric: a dashed ring, and a line in the tooltip.
   * Flagged, never removed -- removing is the reader's call, in the URL.
   */
  const unusual = useMemo(
    () => new Map(keys.map((tool) => [tool, flagOutliers(rows.map((r) => cell(r[tool])))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, keys.join(",")],
  );
  type Mark = {
    tool: string;
    i: number;
    value: number;
    kind: "ring" | "pin" | "flag" | "dnf";
    lane?: number;
  };
  const marks: Mark[] = shown.flatMap(({ tool }) =>
    plotted.flatMap((row, i): Mark[] => {
      const value = cell(row[tool]);
      if (value === null) {
        /* DID NOT FINISH: the line breaks, and a cross on a lane under the
           date labels says why there is no point -- off the plot, so it can
           never be read as a value. */
        const d = detailOn.get(row.date);
        const dnf =
          d !== undefined && (d.partial[tool] !== undefined || (d.failed[tool]?.length ?? 0) > 0);
        return dnf ? [{ tool, i, value: 0, kind: "dnf" }] : [];
      }
      return [
        ...(changed.has(`${tool} ${row.date}`) ? [{ tool, i, value, kind: "ring" as const }] : []),
        ...(unusual.get(tool)?.[i] != null ? [{ tool, i, value, kind: "flag" as const }] : []),
        ...(i === pin ? [{ tool, i, value, kind: "pin" as const }] : []),
      ];
    }),
  );
  /*
   * ONE LANE OF DNFs, a mark per run: a lane per tool stacked down into the
   * brush once a few tools had failed. The mark is the tool's colour when one
   * failed that run, and ink with a count when several did; the tooltip names
   * them.
   */
  const failedOn = new Map<number, string[]>();
  for (const m of marks)
    if (m.kind === "dnf") failedOn.set(m.i, [...(failedOn.get(m.i) ?? []), m.tool]);
  /*
   * The tool singled out by a click on its line: the others' marks dim with
   * their lines. Kept with the chart it was made on, because a remounted
   * chart starts with nothing singled out.
   */
  const chartKey = `${resolvedTheme}:${window.from}:${window.to}`;
  const [single, setSingle] = useState<{ chart: string; tool: string } | null>(null);
  const only = single?.chart === chartKey ? single.tool : null;

  const measured =
    metric === "change"
      ? "Change since the first run in range (%)"
      : metric === "baseline"
        ? `Time as a multiple of ${baselineLabel ?? "the baseline"}'s (×)`
        : metric === "per-package"
          ? "Install time per installed package (ms/pkg)"
          : /* No unit here: a tick is in seconds or milliseconds and says which. */
            `${yLabel}, per ${section === "task-runners" ? "run" : "install"}`;
  const yTitle = `${measured}${derived ? " · derived" : ""}${axis === "log" ? " · log scale" : ""}${
    range === null ? "" : range === "fit" ? " · fit to data" : " · zoomed"
  }`;
  const tick = (v: number) => (v === 0 && metric !== "change" ? "0" : fmt(v));

  /*
   * The stock brush adds an "inside" zoom as well as the slider, and ECharts
   * turns the mouse wheel into zoom for it. So scrolling the PAGE with the
   * pointer over the plot zoomed the chart instead: the range control said
   * "Last 30 days" and the plot showed a week. The brush opens on everything
   * that was loaded (the component's default); this keeps it there until the
   * reader moves it on purpose. Wheel events are stopped on the way down, so
   * the chart never sees them and the page scrolls as it should. Dragging the
   * brush, and the plot, still work.
   */
  const plot = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = plot.current;
    if (el === null) return;
    const stop = (event: WheelEvent) => event.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true, passive: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);

  /*
   * THE PIN. A click on the plot pins the nearest published run, and the same
   * click again releases it. A click on a LINE is not this: the line takes it
   * and singles its tool out, as before. The brush strip is outside the plot's
   * grid, so dragging it pins nothing.
   *
   * The rule and the marks are placed from the chart's own coordinates after
   * every render, so they follow the brush, the scale and a resize. The marks
   * wait for the draw-in to finish rather than stand on an empty plot.
   */
  const rule = useRef<HTMLDivElement | null>(null);
  const over = useRef<HTMLDivElement | null>(null);
  const band = useRef<SVGPathElement | null>(null);
  const layer = useRef<SVGSVGElement | null>(null);

  /*
   * THE VALUE-AXIS ZOOM (`y`). A vertical drag on the axis-label strip left of
   * the plot selects a band of values; release zooms the axis to it. The strip
   * is an element of ours over the labels, so the drag never reaches the plot:
   * the plot's own drag (the brush) and click (the pin) are untouched. A drag
   * shorter than a few pixels is a slip, not a zoom.
   */
  const gutter = useRef<HTMLDivElement | null>(null);
  const selection = useRef<HTMLDivElement | null>(null);
  type Rect = { x: number; y: number; width: number; height: number };
  const gridAt = useRef<Rect | null>(null);
  const dragFrom = useRef<number | null>(null);
  const pointerY = (event: Pointer): number => {
    const g = gridAt.current;
    const top = plot.current?.getBoundingClientRect().top ?? 0;
    return g === null ? NaN : Math.min(Math.max(event.clientY - top, g.y), g.y + g.height);
  };
  const select = (a: number | null, b = a) => {
    const el = selection.current;
    const g = gridAt.current;
    if (el === null) return;
    el.hidden = a === null || b === null || g === null;
    if (a === null || b === null || g === null) return;
    Object.assign(el.style, {
      left: `${g.x}px`,
      width: `${g.width}px`,
      top: `${Math.min(a, b)}px`,
      height: `${Math.abs(a - b)}px`,
    });
  };
  const endDrag = (event: Pointer) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    select(null);
    if (from === null || event.type !== "pointerup") return;
    const to = pointerY(event);
    if (!(Math.abs(to - from) >= 4)) return;
    const mount = plot.current?.querySelector<HTMLElement>("[_echarts_instance_]");
    const chart = mount ? echarts.getInstanceByDom(mount) : undefined;
    if (chart === undefined) return;
    const [a, b] = [from, to].map((p) => Number(chart.convertFromPixel({ yAxisIndex: 0 }, p)));
    const next = formatValueRange(a ?? NaN, b ?? NaN, axis === "log");
    if (parseValueRange(next, axis === "log") !== null) void setParams({ y: next });
  };

  /*
   * THE BAND: for the tool singled out by a click on its line, ±1 standard
   * deviation of its repetitions around each run (`rsd`, pooled across
   * fixtures). Only on a metric that is a time -- a percentage of a
   * percentage is not a spread. Drawn by `place` in the chart's coordinates.
   */
  const bandRuns = (tool: string | null): { i: number; lo: number; hi: number }[] =>
    tool === null || metric === "change" || metric === "baseline"
      ? []
      : plotted.flatMap((row, i) => {
          const v = cell(row[tool]);
          const r = detailOn.get(row.date)?.rsd[tool];
          return v === null || r === undefined ? [] : [{ i, lo: v * (1 - r), hi: v * (1 + r) }];
        });
  const drawn = rows.length > 0 && shown.length > 0;
  /*
   * The vendored chart can replace its ECharts instance without remounting
   * (after a brush commit's reload, for one), and handlers bound to the old
   * instance then hear nothing: the pin click went dead. Watch the mount for a
   * new instance id and rebind.
   */
  const [instance, setInstance] = useState<string | null>(null);
  const appliedFocus = useRef<string | null>(null);
  /*
   * A focus cleared elsewhere -- its chip -- releases the brush back to
   * everything. Read from the address, which changes at once, not from the
   * server's `focus`, which lags a release by a round trip and would undo a
   * drag that has only just set it.
   */
  const lastFocus = useRef(focusParam);
  useEffect(() => {
    const was = lastFocus.current;
    lastFocus.current = focusParam;
    if (was === null || focusParam !== null) return;
    appliedFocus.current = null;
    const mount = plot.current?.querySelector<HTMLElement>("[_echarts_instance_]");
    const chart = mount ? echarts.getInstanceByDom(mount) : undefined;
    const zoom = (
      chart?.getOption() as { dataZoom?: { start?: number; end?: number }[] } | undefined
    )?.dataZoom?.[0];
    if (
      chart !== undefined &&
      zoom !== undefined &&
      ((zoom.start ?? 0) > 0 || (zoom.end ?? 100) < 100)
    ) {
      chart.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    }
  }, [focusParam]);
  useEffect(() => {
    const host = plot.current;
    if (host === null) return;
    const read = () =>
      setInstance(
        host
          .querySelector<HTMLElement>("[_echarts_instance_]")
          ?.getAttribute("_echarts_instance_") ?? null,
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["_echarts_instance_"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const mount = plot.current?.querySelector<HTMLElement>("[_echarts_instance_]");
    const chart = mount ? echarts.getInstanceByDom(mount) : undefined;
    if (chart === undefined) return;

    const onClick = (event: { offsetX: number; offsetY: number; target?: unknown }) => {
      const point = [event.offsetX, event.offsetY];
      if (event.target != null || !chart.containPixel({ gridIndex: 0 }, point)) return;
      const [x] = chart.convertFromPixel({ gridIndex: 0 }, point);
      const date = rows[nearestRun(ran, Math.round(x ?? -1))]?.date;
      if (date !== undefined) void setParams({ at: date === at ? null : date });
    };

    const place = () => {
      const el = rule.current;
      if (el === null || over.current === null) return;
      /* The grid's rectangle is not in the public API; this is where it lives. */
      const grid = (
        chart as unknown as {
          getModel(): {
            getComponent(type: "grid"): {
              coordinateSystem: {
                getRect(): { x: number; y: number; width: number; height: number };
              };
            };
          };
        }
      )
        .getModel()
        .getComponent("grid")
        .coordinateSystem.getRect();
      gridAt.current = grid;
      const inside = (x: number) => x >= grid.x - 1 && x <= grid.x + grid.width + 1;
      /* A zoomed value axis leaves marks above and below the plot: not drawn. */
      const level = (y: number) => y >= grid.y - 1 && y <= grid.y + grid.height + 1;
      if (gutter.current !== null) {
        Object.assign(gutter.current.style, {
          top: `${grid.y}px`,
          width: `${grid.x}px`,
          height: `${grid.height}px`,
        });
        gutter.current.hidden = false;
      }
      /* The band, too, stays on the plot, whichever axis is zoomed. */
      layer.current?.style.setProperty(
        "clip-path",
        `inset(${grid.y}px calc(100% - ${grid.x + grid.width}px) calc(100% - ${grid.y + grid.height}px) ${grid.x}px)`,
      );
      const x = pin < 0 ? NaN : chart.convertToPixel({ xAxisIndex: 0 }, pin);
      el.hidden = !inside(x);
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${grid.y}px`;
      el.style.height = `${grid.height}px`;
      for (const mark of over.current.children as HTMLCollectionOf<HTMLElement>) {
        const lane = mark.dataset.lane;
        const [mx = NaN, my = NaN] =
          lane === undefined
            ? chart.convertToPixel({ gridIndex: 0 }, [
                Number(mark.dataset.i),
                Number(mark.dataset.value),
              ])
            : [
                chart.convertToPixel({ xAxisIndex: 0 }, Number(mark.dataset.i)),
                grid.y + grid.height + 27 + Number(lane) * 11,
              ];
        mark.hidden = !inside(mx) || Number.isNaN(my) || (lane === undefined && !level(my));
        mark.style.left = `${mx}px`;
        mark.style.top = `${my}px`;
      }
      /* The band: one closed shape per unbroken stretch of runs. */
      if (band.current !== null) {
        const runs = bandRuns(band.current.dataset.tool ?? null);
        const at = (i: number, v: number) => chart.convertToPixel({ gridIndex: 0 }, [i, v]);
        const stretches: (typeof runs)[] = [];
        for (const run of runs) {
          const last = stretches.at(-1);
          if (last !== undefined && last.at(-1)?.i === run.i - 1) last.push(run);
          else stretches.push([run]);
        }
        band.current.setAttribute(
          "d",
          stretches
            .filter((s) => s.length > 1)
            .map((s) => {
              const top = s.map((r) => at(r.i, r.hi));
              const bottom = s.map((r) => at(r.i, r.lo)).reverse();
              return `M${[...top, ...bottom].map(([x, y]) => `${x},${y}`).join("L")}Z`;
            })
            .join(""),
        );
      }
    };
    const reveal = () => {
      if (over.current !== null) over.current.hidden = false;
    };

    /*
     * LINKED BRUSHING. When a drag that began on this chart ends with the
     * brush narrowed, its selection becomes the page's `focus`, snapped to
     * published runs. Not a new window: the chart keeps all it loaded and its
     * brush stays where it was let go, while the page's other trends (Trend
     * by tool, the leaderboard's sparklines) are recomputed over the focus.
     * Dragging back out to everything clears it, as does its chip.
     */
    let dragging = false;
    const onDown = () => {
      dragging = true;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      const zoom = (
        chart.getOption() as {
          dataZoom?: { start?: number; end?: number; startValue?: number; endValue?: number }[];
        }
      ).dataZoom?.[0];
      if (zoom === undefined) return;
      /* Dragged back out to everything: no focus. */
      if ((zoom.start ?? 0) <= 0 && (zoom.end ?? 100) >= 100) {
        if (focus !== null) void setParams({ focus: null });
        return;
      }
      const first = rows[nearestRun(ran, Number(zoom.startValue))]?.date;
      const last = rows[nearestRun(ran, Number(zoom.endValue))]?.date;
      if (first === undefined || last === undefined || first >= last) return;
      if (first === focus?.from && last === focus?.to) return;
      void setParams({ focus: `${first}~${last}`, at: null });
    };
    const host = plot.current;
    host?.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);

    /* A focus from the address opens the brush on it -- once per instance, and
       only while the brush still shows everything, so it never fights a drag. */
    if (focus !== null && appliedFocus.current !== `${instance}:${focus.from}~${focus.to}`) {
      const zoom = (chart.getOption() as { dataZoom?: { start?: number; end?: number }[] })
        .dataZoom?.[0];
      const a = rows.findIndex((row) => row.date === focus.from);
      const b = rows.findIndex((row) => row.date === focus.to);
      if (
        zoom !== undefined &&
        (zoom.start ?? 0) <= 0 &&
        (zoom.end ?? 100) >= 100 &&
        a >= 0 &&
        b > a
      ) {
        chart.dispatchAction({ type: "dataZoom", startValue: a, endValue: b });
      }
      appliedFocus.current = `${instance}:${focus.from}~${focus.to}`;
    }

    const zr = chart.getZr();
    zr.on("click", onClick);
    chart.on("rendered", place);
    chart.on("finished", reveal);
    place();
    /* A remount can finish its draw-in before this listener is attached. */
    const fallback = setTimeout(reveal, 1500);
    return () => {
      clearTimeout(fallback);
      host?.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      if (chart.isDisposed()) return;
      zr.off("click", onClick);
      chart.off("rendered", place);
      chart.off("finished", reveal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, instance, drawn, rows, plotted, pin, at, marks.length, only, focus]);

  useEffect(() => {
    if (pin < 0) return;
    const onKey = (event: KeyboardEvent) => {
      /* Escape inside an open menu or popover closes that, and only that. */
      if (event.key !== "Escape") return;
      if ((event.target as Element).closest?.("[role=menu],[role=dialog]")) return;
      void setParams({ at: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pin, setParams]);

  const versionsOn = useMemo(() => new Map(versions.map((v) => [v.date, v.versions])), [versions]);

  /*
   * A log axis ticks only on whole decades, so a zoom inside one decade would
   * label nothing but its ends. Inside a decade it gets five even steps of
   * its own (`interval` is in log units), each labelled with its value.
   */
  const decades = (lo: number, hi: number) => {
    const span = Math.log10(hi / lo);
    return span > 0 && span < 1 ? { interval: span / 5 } : {};
  };
  const extent = useMemo((): [number, number] => {
    const values = shown.flatMap(({ tool }) =>
      plotted.flatMap((r) => {
        const v = cell(r[tool]);
        return v !== null && v > 0 ? [v] : [];
      }),
    );
    return [Math.min(...values), Math.max(...values)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotted, shown.map((t) => t.tool).join(",")]);

  const chartOptions = useMemo(
    () => ({
      tooltip: {
        ...tooltipBaseOption({
          present: true,
          cursor: true,
          tokens: { mutedForeground: "", border: "", foreground: "", background: "" },
          position: "variable",
          axisPointerColor: "var(--border)",
          strokeWidth: 1,
        }),
        formatter: (
          items: {
            seriesId?: string;
            seriesName: string;
            value: number | null;
            axisValue: string;
          }[],
        ) => {
          /* A tool's own line only: not its marker series, not the brush's. */
          const real = items.filter((i) => !String(i.seriesId ?? "").includes("__"));
          const date = items[0]?.axisValue ?? "";
          const index = rows.findIndex((r) => r.date === date);
          const detail = detailOn.get(date);
          const ran = real
            .filter((i) => typeof i.value === "number")
            .sort((a, b) => (b.value as number) - (a.value as number));
          const muted = (text: string) =>
            `<span class="font-mono text-muted-foreground">${escapeHtml(text)}</span>`;
          /* Seconds against the tool's previous run in range. */
          const since = (tool: string): string => {
            const now = cell(rows[index]?.[tool]);
            for (let k = index - 1; k >= 0 && now !== null; k--) {
              const before = cell(rows[k]?.[tool]);
              if (before !== null && before > 0) {
                const f = now / before - 1;
                return ` ${muted(`${f > 0 ? "+" : ""}${(f * 100).toFixed(1)}%`)}`;
              }
            }
            return "";
          };
          const lines = ran.map((i) => {
            const tool = String(i.seriesId ?? "");
            const change = changed.get(`${tool} ${date}`);
            const note = versionNote(versionsOn.get(date)?.[tool], change);
            const step =
              change === undefined
                ? null
                : stepChange(
                    rows.map((r) => cell(r[tool])),
                    index,
                  );
            const odd = unusual.get(tool)?.[index] ?? null;
            const extra = [
              ...(step === null
                ? []
                : [`median ${step.change > 0 ? "+" : ""}${(step.change * 100).toFixed(1)}% after`]),
              ...(odd === null
                ? []
                : [`unusual: ${odd > 0 ? "+" : ""}${(odd * 100).toFixed(0)}% vs 7-run median`]),
            ];
            return tooltipRow({
              indicatorHtml: tooltipIndicatorHtml(tool, 1),
              /* The version it ran, muted; a change, in ink. */
              labelText:
                escapeHtml(i.seriesName) +
                (note === ""
                  ? ""
                  : ` <span class="font-mono${change ? " text-foreground" : ""}">${escapeHtml(note)}</span>`) +
                (extra.length === 0
                  ? ""
                  : ` <span class="text-foreground">${escapeHtml(extra.join(" · "))}</span>`),
              valueText: fmt(i.value as number) + (metric === "total" ? since(tool) : ""),
              dimmed: "",
            });
          });
          /* Tools with no point here because they did not finish. */
          const dnf = shown.flatMap(({ tool, label }) => {
            if (detail === undefined || cell(plotted[index]?.[tool]) !== null) return [];
            const failed = detail.failed[tool] ?? [];
            const partial = detail.partial[tool];
            if (failed.length === 0 && partial === undefined) return [];
            const why = failed
              .map((f) => `${f.fixture}${Number.isNaN(f.exit) ? "" : ` (exit ${f.exit})`}`)
              .join(", ");
            return [
              tooltipRow({
                indicatorHtml: tooltipIndicatorHtml(tool, 1),
                labelText: `${escapeHtml(label)} ${muted(why === "" ? "missing a fixture" : `DNF ${why}`)}`,
                valueText:
                  partial === undefined
                    ? "DNF"
                    : `DNF ${muted(`${formatDuration(partial.mean)} on ${partial.of}/${detail.fixtures.length}`)}`,
                dimmed: "",
              }),
            ];
          });
          const most = Math.max(0, ...trend.map((d) => d.fixtures.length));
          const short =
            detail !== undefined && detail.fixtures.length < most
              ? `<p class="text-muted-foreground">${detail.fixtures.length} of ${most} fixtures ran</p>`
              : "";
          return tooltipShell({
            label: escapeHtml(shortDay(date)),
            body:
              ran.length === 0 && dnf.length === 0
                ? `<span class="text-muted-foreground">No run published</span>`
                : short + [...lines, ...dnf].join(""),
            roundness: "lg",
            variant: "default",
          });
        },
      },
      ...(axis === "log" || range !== null
        ? {
            /*
             * Two axes, because the brush is a second grid with its own: the
             * component builds `[main, mini]` and a shallow merge replaces
             * both. The mini axis is theirs (`{ type, gridIndex: 1, show:
             * false }`) with the same change of type, so the brush's
             * miniature is on the scale the plot is on -- and never zoomed:
             * it shows everything that was loaded.
             */
            yAxis: [
              {
                type: axis === "log" ? "log" : "value",
                /* The zoom. `scale` lets a linear axis leave zero; a log axis
                   rounds out to whole decades unless it is given its ends. */
                ...(range === null
                  ? {}
                  : range === "fit"
                    ? axis === "log"
                      ? { min: "dataMin", max: "dataMax", ...decades(...extent) }
                      : { scale: true }
                    : {
                        min: range[0],
                        max: range[1],
                        ...(axis === "log" ? decades(...range) : {}),
                      }),
                show: true,
                axisLine: { show: false },
                axisTick: EVIL_TICK_DOT,
                splitLine: EVIL_SPLIT_LINE,
                axisLabel: {
                  ...EVIL_AXIS_LABEL,
                  formatter: tick,
                },
              },
              { type: axis === "log" ? "log" : "value", gridIndex: 1, show: false },
            ],
          }
        : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      axis,
      y,
      extent,
      yTitle,
      changed,
      versionsOn,
      metric,
      rows,
      plotted,
      detailOn,
      unusual,
      shown.length,
    ],
  );

  return (
    <Figure
      id={id}
      kind="line"
      title={title}
      live
      tabs={tabs}
      firstTabActive={firstTabActive}
      actions={
        <>
          {/* First in the row, so nothing else moves when it appears. */}
          {range === null ? null : (
            <Button
              variant="outline"
              size="sm"
              className="font-normal"
              onClick={() => void setParams({ y: null })}
            >
              <ZoomOut aria-hidden />
              <span className="max-sm:sr-only">Reset zoom</span>
            </Button>
          )}
          <RangePicker
            dates={window.dates}
            end={window.end}
            from={window.from}
            to={window.to}
            custom={window.custom}
          />
          {/* What is plotted. Total time is the measurement; the rest are
              derived from it and labelled so, here and on the axis. */}
          {fixedMetric !== undefined ? null : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-normal">
                  <Ruler aria-hidden />
                  <span className="sr-only">Metric: </span>
                  <span className="max-sm:sr-only">{METRIC_LABELS[metric]}</span>
                  {derived ? <Derived /> : null}
                  <ChevronDown aria-hidden className="max-sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[15rem]">
                <DropdownMenuRadioGroup
                  value={metric}
                  onValueChange={(value) =>
                    void setParams({
                      metric: METRIC_ORDER.find((m) => m === value) ?? "total",
                      at: null,
                      /* A zoom is in the old metric's units. */
                      y: null,
                    })
                  }
                >
                  {METRIC_ORDER.filter((m) => m !== "per-package" || perPackage)
                    .filter((m) => m !== "baseline" || baseline !== null)
                    .map((m) => (
                      <DropdownMenuRadioItem key={m} value={m} className="justify-between gap-4">
                        {m === "baseline"
                          ? `Relative to ${baselineLabel ?? "baseline"}`
                          : METRIC_LABELS[m]}
                        {m === "total" ? null : <Derived />}
                      </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="font-normal">
                <SlidersHorizontal aria-hidden />
                <span className="max-sm:sr-only">Display</span>
                <ChevronDown aria-hidden className="max-sm:hidden" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Scale
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={axis}
                onValueChange={(value) =>
                  void setParams({ scale: value === "log" ? "log" : "linear" })
                }
              >
                <DropdownMenuRadioItem value="linear">Linear</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="log" disabled={metric === "change"}>
                  Log
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Value range
              </DropdownMenuLabel>
              {/* A dragged range checks neither; "Reset zoom" names it. */}
              <DropdownMenuRadioGroup
                value={range === null ? "full" : range === "fit" ? "fit" : ""}
                onValueChange={(value) => void setParams({ y: value === "fit" ? "fit" : null })}
              >
                <DropdownMenuRadioItem value="full">Full</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="fit">Fit to shown tools</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <p className="px-2 pb-1.5 text-xs text-muted-foreground">
                Or drag along the axis to zoom.
              </p>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Smoothing
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={smooth}
                onValueChange={(value) =>
                  void setParams({ smooth: value === "median7" ? "median7" : "off" })
                }
              >
                <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="median7">7-run median</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Missed runs
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={gaps}
                onValueChange={(value) =>
                  void setParams({ gaps: value === "connect" ? "connect" : "hole" })
                }
              >
                <DropdownMenuRadioItem value="connect">
                  Bridge with a dotted line
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hole">Leave a gap</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <ChartFrame
        legend={
          <>
            {pin < 0 || at === null ? null : (
              <PinnedRun
                date={at}
                label={shortDay(at)}
                detail={detailOn.get(at)}
                section={section}
                baselineName={baselineLabel}
                isShown={at === window.end}
                ringNotes={shown.flatMap(({ tool }): PinnedNote[] => {
                  const values = rows.map((r) => cell(r[tool]));
                  const change = changed.get(`${tool} ${at}`);
                  const step = change === undefined ? null : stepChange(values, pin);
                  const odd = unusual.get(tool)?.[pin] ?? null;
                  const signed = (f: number) => `${f > 0 ? "+" : ""}${(f * 100).toFixed(1)}%`;
                  return [
                    ...(change === undefined
                      ? []
                      : [
                          {
                            tool,
                            kind: "version" as const,
                            text: versionNote(versionsOn.get(at)?.[tool], change),
                            detail:
                              step === null
                                ? undefined
                                : `median ${signed(step.change)} over the ${step.after} runs from here, against the ${step.before} before`,
                          },
                        ]),
                    ...(odd === null
                      ? []
                      : [
                          {
                            tool,
                            kind: "unusual" as const,
                            text: "unusual run",
                            detail: `${signed(odd)} against the median of the runs around it`,
                          },
                        ]),
                  ];
                })}
                tools={shown
                  .map(({ tool }) => {
                    const now = cell(rows[pin]?.[tool]);
                    let before: number | null = null;
                    for (let k = pin - 1; k >= 0 && before === null; k--)
                      before = cell(rows[k]?.[tool]);
                    const base = baseline === null ? null : cell(rows[pin]?.[baseline]);
                    const value = cell(plotted[pin]?.[tool]);
                    return {
                      tool,
                      sort: value ?? Infinity,
                      value,
                      shown: value === null ? null : fmt(value),
                      sincePrevious:
                        now === null || before === null || before <= 0 ? null : now / before - 1,
                      versusBaseline:
                        now === null || base === null || base <= 0 ? null : now / base,
                      version: versionsOn.get(at)?.[tool] ?? null,
                    };
                  })
                  .sort((a, b) => a.sort - b.sort)}
                onOpen={() => void setParams({ date: at, at: null, from: null, to: null })}
                onExclude={(entry) =>
                  void setParams({ exclude: [...new Set([...exclude, entry])], at: null })
                }
                onClose={() => void setParams({ at: null })}
              />
            )}
            <MarkKey
              kinds={new Set(marks.map((m) => m.kind))}
              baseline={baseline !== null && shown.some((t) => t.tool === baseline)}
              lone={lone.size > 0}
              bridged={
                bridged && shown.some(({ tool }) => plotted.some((r) => cell(r[tool]) === null))
              }
            />
            <ChartLegend
              section={section}
              baseline={baseline}
              entries={tools.map(({ tool }) => {
                const value = pin < 0 ? latest(tool) : cell(plotted[pin]?.[tool]);
                return {
                  tool,
                  on: !hidden.includes(tool),
                  value: value === null ? (pin < 0 ? null : "—") : fmt(value),
                };
              })}
              onToggle={(tool) =>
                void setParams({
                  hide: hidden.includes(tool)
                    ? hidden.filter((t) => t !== tool)
                    : [...hidden, tool],
                })
              }
              onShowAll={() => void setParams({ hide: [] })}
            />
          </>
        }
      >
        {exclude.length === 0 ? null : (
          /* Every exclusion, visible and reversible: they are in the URL and
             in every trend on the page, so they are never silent. */
          <div className="mb-4">
            <Callout
              title={`${exclude.length} exclusion${exclude.length === 1 ? "" : "s"} from every trend`}
            >
              <span className="flex flex-wrap items-center gap-1.5">
                {exclude.map((entry) => {
                  const [tool, date] = entry.includes("@") ? entry.split("@") : [null, entry];
                  const label = tools.find((t) => t.tool === tool)?.label ?? tool;
                  return (
                    <button
                      key={entry}
                      type="button"
                      onClick={() =>
                        void setParams({ exclude: exclude.filter((e) => e !== entry) })
                      }
                      className="inline-flex h-6 items-center gap-1 rounded-md border bg-background px-2 font-mono text-xs text-foreground hover:bg-accent"
                      aria-label={`Restore ${label === null ? "run" : label} on ${date}`}
                    >
                      {label === null ? "whole run" : label} · {shortDay(date ?? "")}
                      <X aria-hidden className="size-3 text-muted-foreground" />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => void setParams({ exclude: [] })}
                  className="ml-1 text-xs underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  Restore all
                </button>
              </span>
            </Callout>
          </div>
        )}
        {/* What the values are, above the plot where it is read first: not turned on its side beside it. */}
        <p className="pb-3 font-mono text-xs text-muted-foreground">{yTitle}</p>
        <div ref={plot} className="relative">
          {drawn ? (
            <>
              <div
                ref={gutter}
                hidden
                aria-hidden
                title="Drag to zoom the value axis"
                className="absolute left-0 z-[2] cursor-ns-resize touch-none rounded-sm hover:bg-foreground/5"
                onPointerDown={(event) => {
                  if (event.button !== 0 || gridAt.current === null) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragFrom.current = pointerY(event);
                  select(dragFrom.current);
                }}
                onPointerMove={(event) => {
                  if (dragFrom.current !== null) select(dragFrom.current, pointerY(event));
                }}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
              <div
                ref={selection}
                hidden
                aria-hidden
                className="pointer-events-none absolute z-[2] border-y border-foreground/30 bg-foreground/5"
              />
            </>
          ) : null}
          <svg
            ref={layer}
            aria-hidden
            className={`pointer-events-none absolute inset-0 z-[1] size-full overflow-visible ${loading ? "invisible" : ""}`}
          >
            <path
              key={`band:${chartKey}:${only ?? ""}`}
              ref={band}
              data-tool={only ?? undefined}
              style={{ fill: only === null ? "none" : paint(only), fillOpacity: 0.14 }}
            />
          </svg>
          <div
            ref={rule}
            hidden
            aria-hidden
            className={`pointer-events-none absolute w-px bg-muted-foreground ${loading ? "invisible" : ""}`}
          />
          <div
            key={`marks:${chartKey}`}
            ref={over}
            hidden
            aria-hidden
            className={`pointer-events-none ${loading ? "invisible" : ""}`}
          >
            {[...failedOn].map(([i, failed]) => (
              /* DID NOT FINISH: an icon on the lane under the dates, off the plot. */
              <span
                key={`dnf:${i}`}
                data-i={i}
                data-lane={0}
                hidden
                className={`absolute flex -translate-1/2 items-center gap-0.5 font-mono text-[9px] leading-none font-semibold ${
                  only !== null && !failed.includes(only) ? "opacity-30" : ""
                }`}
                style={{
                  color: failed.length === 1 ? paint(failed[0] ?? "") : "var(--foreground)",
                }}
              >
                <CircleX className="size-2.5" strokeWidth={2.5} />
                {failed.length === 1 ? null : failed.length}
              </span>
            ))}
            {marks.map(({ tool, i, value, kind }) => {
              const dim = only !== null && only !== tool ? "opacity-30" : "";
              if (kind === "dnf") return null;
              if (kind === "pin")
                return (
                  <span
                    key={`${tool}:${i}:pin`}
                    data-i={i}
                    data-value={value}
                    hidden
                    className={`absolute size-[7px] -translate-1/2 rounded-full ring-[1.5px] ring-(--code-editor-background) ${dim}`}
                    style={{ background: paint(tool) }}
                  />
                );
              /* A version change (a tag) or an unusual run (a warning): an icon on the line, in its colour. */
              const Icon = kind === "ring" ? Tag : TriangleAlert;
              return (
                <span
                  key={`${tool}:${i}:${kind}`}
                  data-i={i}
                  data-value={value}
                  hidden
                  /* Filled in the tool's colour, the icon cut out of it in the panel's: legible over any line. */
                  className={`absolute grid size-4 -translate-1/2 place-items-center rounded-full text-(--code-editor-background) ring-[1.5px] ring-(--code-editor-background) ${dim}`}
                  style={{ background: paint(tool) }}
                >
                  <Icon className="size-2.5" strokeWidth={2.5} />
                </span>
              );
            })}
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-sm text-absent">No runs in range to draw.</p>
          ) : shown.length === 0 ? (
            <p className="py-16 text-sm text-muted-foreground">Every tool is hidden.</p>
          ) : (
            <EChartsLineChart
              /*
               * Remounted on a theme change (see 3 above), and when the loaded
               * window changes -- which is also what resets the brush: its
               * selection is a zoom WITHIN what was loaded, so a new range
               * starts from the whole of it.
               */
              key={chartKey}
              data={data}
              config={config}
              xDataKey="date"
              renderer={RENDERER}
              chartOptions={chartOptions}
              isLoading={loading}
              /* Deferred: the component reports a selection from inside its
                 own state update, which is during its render. */
              onSelectionChange={(tool) =>
                queueMicrotask(() => setSingle(tool === null ? null : { chart: chartKey, tool }))
              }
              className={PLOT}
            >
              <EChartsLineChart.Grid />
              <EChartsLineChart.XAxis
                tickFormatter={(v: string) => (v.length === 10 ? shortDay(v) : v)}
              />
              <EChartsLineChart.YAxis tickFormatter={tick} />
              <EChartsLineChart.Tooltip />
              {/*
               * EvilCharts' brush, as its docs wire it: a miniature of every
               * loaded run under the plot, with a draggable window that zooms
               * the plot on the client. Nothing refetches -- the date range
               * above decides what is loaded; this looks closer at it.
               */}
              <EChartsLineChart.Brush formatLabel={(v: string) => shortDay(String(v))} />
              {shown.map(({ tool }) => (
                <EChartsLineChart.Line
                  key={tool}
                  dataKey={tool}
                  /*
                   * EXPLICIT, not inherited.
                   *
                   * The vendored component defaults this to false, and so did
                   * Recharts — by a different route. "Same default" is not
                   * "same semantics", and this is one prop away from drawing a
                   * straight line across eleven absent days, which looks
                   * BETTER rather than broken. Verified on the 2026-06-17 ->
                   * 2026-06-29 fixture.
                   */
                  connectNulls={false}
                  /* Every tool the same weight. The stock 0.8px relied on its
                     dots to be seen; without them it needs a little more. */
                  strokeWidth={smoothed ? 0.6 : STROKE}
                  strokeVariant={tool === baseline ? "dashed" : "solid"}
                  isClickable
                >
                  <EChartsLineChart.ActiveDot variant="border" />
                </EChartsLineChart.Line>
              ))}
              {smoothed
                ? shown.map(({ tool }) => (
                    <EChartsLineChart.Line
                      key={`${tool}${SMOOTH}`}
                      dataKey={`${tool}${SMOOTH}`}
                      connectNulls={false}
                      strokeWidth={STROKE + 0.5}
                      strokeVariant={tool === baseline ? "dashed" : "solid"}
                    />
                  ))
                : null}
              {bridged
                ? shown.flatMap(({ tool }) =>
                    BRIDGE.map((key) => (
                      <EChartsLineChart.Line
                        key={`${tool}${key}`}
                        dataKey={`${tool}${key}`}
                        /* The bridge is its own series of interpolated runs: the line still never joins a hole. */
                        connectNulls={false}
                        strokeWidth={1}
                        strokeVariant="dashed"
                      />
                    )),
                  )
                : null}
              {[...lone.keys()].map((tool) => (
                <EChartsLineChart.Line
                  key={`${tool}${LONE}`}
                  dataKey={`${tool}${LONE}`}
                  connectNulls={false}
                  strokeWidth={STROKE}
                >
                  <EChartsLineChart.Dot variant="default" />
                </EChartsLineChart.Line>
              ))}
            </EChartsLineChart>
          )}
        </div>
      </ChartFrame>
    </Figure>
  );
};

/**
 * What the marks on the plot mean, for the ones in view: an icon a reader has
 * to guess at is decoration. Neutral ink, since each mark is drawn in its
 * tool's colour.
 */
const MarkKey = ({
  kinds,
  baseline,
  lone,
  bridged,
}: {
  kinds: ReadonlySet<string>;
  baseline: boolean;
  lone: boolean;
  bridged: boolean;
}) => {
  const items = [
    kinds.has("ring") && {
      icon: <Tag className="size-2.5" strokeWidth={2.5} />,
      text: "Version changed",
    },
    kinds.has("flag") && {
      icon: <TriangleAlert className="size-2.5" strokeWidth={2.5} />,
      text: "Unusual run (far from the runs around it)",
    },
    kinds.has("dnf") && {
      icon: <CircleX className="size-2.5" strokeWidth={2.5} />,
      text: "Did not finish: under the dates; a number, how many tools",
      bare: true,
    },
    lone && {
      icon: <span className="size-1.5 rounded-full bg-current" />,
      text: "A run with no run either side",
      bare: true,
    },
    bridged && {
      icon: <span className="w-3 border-t border-dashed" style={{ borderColor: GAP }} />,
      text: "Bridges a missed run: no time there",
      bare: true,
    },
    baseline && {
      icon: <span className="w-3 border-t-[1.5px] border-dashed border-current" />,
      text: "Dashed: the baseline, which multiples are taken against",
      bare: true,
    },
  ].filter((item) => item !== false);
  if (items.length === 0) return null;
  return (
    <ul
      aria-label="What the marks mean"
      className="flex flex-wrap gap-x-5 gap-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground"
    >
      {items.map(({ icon, text, bare }) => (
        <li key={text} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={
              bare
                ? "grid size-4 place-items-center text-foreground"
                : "grid size-4 place-items-center rounded-full bg-foreground text-background"
            }
          >
            {icon}
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
};

/** The trend's frame while the report loads: EvilCharts' loading wave, or a still tint under reduced motion. */
export const TrendSkeleton = () => {
  const reduced = useReducedMotion() === true;
  return (
    <Figure id="time-trend" kind="line" title="Performance over time" live>
      <ChartFrame>
        {reduced ? (
          <div className={`${PLOT} rounded-md bg-muted`} />
        ) : (
          <EChartsLineChart data={[]} config={{}} renderer={RENDERER} isLoading className={PLOT}>
            <EChartsLineChart.Grid />
            <EChartsLineChart.XAxis />
            <EChartsLineChart.YAxis />
          </EChartsLineChart>
        )}
      </ChartFrame>
    </Figure>
  );
};
