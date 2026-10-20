/**
 * The figures' charts for the social cards: the same engine the page draws
 * them with, ECharts, in its server-side mode -- an SVG string, no browser --
 * styled as the page's charts are. Takumi draws the SVG but not text inside
 * it, so the cards set their labels around the chart themselves.
 */
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { bridges } from "@/lib/figures";

echarts.use([LineChart, BarChart, GridComponent, SVGRenderer]);

const BORDER = "#262626";
const GAP = "#737373";

/** A round top for the value axis, so the card can label it. */
export const niceMax = (v: number): number => {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return (Math.ceil((v / p) * 2) / 2) * p;
};

const render = (width: number, height: number, option: object): string => {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width, height });
  chart.setOption({ animation: false, backgroundColor: "transparent", ...option });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
};

const grid = { left: 0, right: 0, top: 4, bottom: 0 };
const valueAxis = (max: number) => ({
  type: "value",
  min: 0,
  max,
  axisLabel: { show: false },
  splitLine: { lineStyle: { color: BORDER, type: [3, 3] } },
});

/**
 * The trend: a line per tool, the baseline dashed, and the page's default
 * for a missed run -- a grey dotted bridge, never the line itself.
 */
export const lineSvg = (
  rows: readonly { readonly [key: string]: string | number | null }[],
  tools: readonly string[],
  colors: { readonly [tool: string]: string },
  baseline: string | null,
  size: { width: number; height: number },
): { svg: string; max: number } => {
  const cell = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const max = niceMax(Math.max(0, ...rows.flatMap((r) => tools.map((t) => cell(r[t]) ?? 0))));
  const series = tools.flatMap((tool) => {
    const values = rows.map((r) => cell(r[tool]));
    return [
      ...bridges(values).map((data) => ({
        type: "line",
        data,
        showSymbol: false,
        lineStyle: { color: GAP, width: 1.5, type: [2, 4] },
      })),
      {
        type: "line",
        data: values,
        showSymbol: false,
        connectNulls: false,
        lineStyle: {
          color: colors[tool] ?? GAP,
          width: 3,
          type: tool === baseline ? [8, 6] : "solid",
        },
      },
    ];
  });
  return {
    max,
    svg: render(size.width, size.height, {
      grid,
      xAxis: { type: "category", data: rows.map((_, i) => i), show: false, boundaryGap: false },
      yAxis: valueAxis(max),
      series,
    }),
  };
};

/** The page's stripped bar: a bright cap on a body dimmed to a fifth of the colour. */
const stripped = (color: string, value: number, max: number, pixels: number) => {
  const f = Math.min(0.85, 4 / Math.max(1, (value / max) * pixels));
  const dim = `${color}38`;
  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color },
      { offset: f, color },
      { offset: f, color: dim },
      { offset: 1, color: dim },
    ],
  };
};

/** Every fixture's times: a group per fixture, a bar per tool in leaderboard order. */
export const groupedSvg = (
  fixtures: readonly { readonly values: { readonly [tool: string]: number } }[],
  tools: readonly string[],
  colors: { readonly [tool: string]: string },
  size: { width: number; height: number },
): { svg: string; max: number } => {
  const max = niceMax(Math.max(0, ...fixtures.flatMap((f) => Object.values(f.values))));
  return {
    max,
    svg: render(size.width, size.height, {
      grid,
      xAxis: { type: "category", data: fixtures.map((_, i) => i), show: false },
      yAxis: valueAxis(max),
      series: tools.map((tool) => ({
        type: "bar",
        barMaxWidth: 14,
        barGap: "20%",
        data: fixtures.map((f) => {
          const v = f.values[tool];
          return v === undefined
            ? "-"
            : {
                value: v,
                itemStyle: {
                  color: stripped(colors[tool] ?? GAP, v, max, size.height - grid.top),
                  borderRadius: [3, 3, 0, 0],
                },
              };
        }),
      })),
    }),
  };
};
