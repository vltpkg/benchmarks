/**
 * The one set of chart styling values, shared by every figure.
 *
 * These are EvilCharts' own, copied value for value from the vendored line
 * chart's option builder (`ui/echarts-line-chart.tsx`, `buildMainAxes`) and
 * dot styles (`ui/echarts-dot.tsx`). The stock line chart applies them itself;
 * the figures EvilCharts has no component for -- the bars -- and
 * the log axis the line chart has no option for take them from here, so a bar
 * chart's axis and a line chart's axis are the same axis.
 *
 * Colours are custom-property strings. The SVG renderer writes them into the
 * mark's style, so the browser resolves them and re-resolves them when the
 * theme changes.
 *
 * If EvilCharts is re-vendored, compare this file against `buildMainAxes`.
 */
export const EVIL_MUTED = "var(--muted-foreground)";
export const EVIL_BORDER = "var(--border)";
export const EVIL_INK = "var(--foreground)";

/** Axis text: their size. */
export const EVIL_AXIS_TEXT = 10;
/** Data labels on marks (a bar's value, a row's name), which they do not have. */
export const EVIL_LABEL_TEXT = 12;

/** A round dot at each tick: a near-zero-length tick with round caps. */
export const EVIL_TICK_DOT = {
  show: true,
  length: 0.5,
  lineStyle: { color: EVIL_BORDER, width: 3, cap: "round" },
} as const;

/** Value-axis split lines: dashed 3/3 in the border colour. */
export const EVIL_SPLIT_LINE = {
  show: true,
  lineStyle: { color: EVIL_BORDER, type: [3, 3], width: 1 },
} as const;

export const EVIL_AXIS_LABEL = {
  show: true,
  color: EVIL_MUTED,
  fontSize: EVIL_AXIS_TEXT,
  margin: 8,
} as const;

/** The intro draw-in, in milliseconds. */
export const EVIL_REVEAL = 1000;

/** `&`, `<` and friends: tool names come from published files, not from us. */
export const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
