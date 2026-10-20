/**
 * Shaping for the figures -- pure, and decided on the server.
 *
 * The figures in `components/charts-figures.tsx` are client islands that draw
 * what they are given. Every decision about WHAT may be drawn is made here,
 * where it can be tested without a DOM: which tools have a bar, and what a
 * missing cell becomes. Honesty inventory item 18.
 */
import type { FixtureRow } from "./measurements.ts";

export interface Bar {
  readonly tool: string;
  readonly value: number;
}

const ascending = (bars: readonly Bar[]): Bar[] =>
  bars.filter((b) => Number.isFinite(b.value) && b.value > 0).sort((a, b) => a.value - b.value);

/**
 * The bar figure's bars: each tool's mean across the fixtures given.
 *
 * Only a tool with a completed run on EVERY fixture gets a bar. A mean over
 * five fixtures drawn beside means over six is the comparison the headline
 * refuses to make, and a bar makes it more persuasively than a sentence. The
 * tools left out are returned in `partial` so the figure can name them; with
 * one fixture selected nothing is partial and these are simply its times.
 */
export const meanBars = (rows: readonly FixtureRow[]): { bars: Bar[]; partial: string[] } => {
  const measured = rows.filter((r) => r.values.length > 0 || r.failed.length > 0);
  const tools = [
    ...new Set(measured.flatMap((r) => [...r.values.map((v) => v.tool), ...r.failed])),
  ];
  const bars: Bar[] = [];
  const partial: string[] = [];
  for (const tool of tools) {
    const values = measured.flatMap((r) => r.values.filter((v) => v.tool === tool));
    if (values.length < measured.length) {
      partial.push(tool);
      continue;
    }
    bars.push({ tool, value: values.reduce((sum, v) => sum + v.value, 0) / values.length });
  }
  return { bars: ascending(bars), partial };
};

/**
 * Each fixture's bars: the times measured on it, fastest first, and the tools
 * whose run there failed, to be named rather than drawn. Every tool that
 * finished a fixture is drawn on it, whatever it did elsewhere: on one
 * fixture, a time is just a time.
 */
export const fixtureBars = (rows: readonly FixtureRow[]) =>
  rows.map((r) => ({ fixture: r.fixture, bars: ascending(r.values), failed: r.failed }));

/**
 * The dotted bridges over a line's holes, when the reader asks for them: the
 * straight line from the last run before each hole to the first run after,
 * as values on the runs between, and nothing anywhere else. Drawn as its own
 * series, so the line itself never joins across a hole and a bridge never
 * looks measured. A hole at either end has nothing to bridge to.
 *
 * Two series, the holes taken in turn: two holes either side of a run, or of
 * two adjacent runs, would otherwise make one bridge drawn over the measured
 * segment between them.
 */
export const bridges = (
  values: readonly (number | null)[],
): [(number | null)[], (number | null)[]] => {
  const out: [(number | null)[], (number | null)[]] = [
    values.map(() => null),
    values.map(() => null),
  ];
  let last = -1;
  let holes = 0;
  values.forEach((v, i) => {
    if (v === null) return;
    const before = last >= 0 ? values[last] : null;
    if (before != null && i - last > 1) {
      const series = out[holes++ % 2] as (number | null)[];
      for (let k = last; k <= i; k++) series[k] = before + ((v - before) * (k - last)) / (i - last);
    }
    last = i;
  });
  return out;
};

/* The first six, and the baseline wherever it ranks: enough to show the shape,
   with the count of what is left out stated rather than implied. */
export const shownBars = <B extends { readonly tool: string }>(
  bars: readonly B[],
  baseline: string | null,
): B[] => bars.filter((b, i) => i < 6 || b.tool === baseline);

/**
 * Which runs in a date-aligned series have no measured neighbour.
 *
 * A line chart with no point markers draws a run only as part of a segment,
 * and a segment needs two adjacent runs. A run with a hole on both sides --
 * or at the edge of the window with a hole on its one side -- has no segment,
 * so it would simply not be drawn: a published measurement, silently missing.
 * These are the runs that get a marker of their own.
 */
export const loneRuns = (values: readonly (number | null)[]): boolean[] =>
  values.map(
    (value, i) =>
      value !== null && (values[i - 1] ?? null) === null && (values[i + 1] ?? null) === null,
  );

/**
 * The published run nearest a position on the date axis; -1 when there is
 * none. The axis has a slot for every calendar day, so a click can land on a
 * day nothing ran: the pin goes to a run, never to a hole. A tie goes to the
 * earlier run.
 */
export const nearestRun = (ran: readonly boolean[], index: number): number => {
  const at = Math.min(Math.max(index, 0), ran.length - 1);
  for (let d = 0; d < ran.length; d++) {
    if (ran[at - d]) return at - d;
    if (ran[at + d]) return at + d;
  }
  return -1;
};

/**
 * How a tool moved across the window: from its first run in it to its last.
 *
 * `null` with fewer than two runs -- one run is not a change, and a
 * percentage against nothing would be a number with no meaning. The indices
 * say which two runs were compared, since a tool need not have run on the
 * window's first or last day. Negative is faster.
 */
export const windowChange = (
  values: readonly (number | null)[],
): { from: number; to: number; change: number } | null => {
  const from = values.findIndex((v) => v !== null && v > 0);
  const to = values.findLastIndex((v) => v !== null);
  const first = values[from];
  const last = values[to];
  if (first == null || last == null || to <= from) return null;
  return { from, to, change: (last - first) / first };
};

/* ------------------------------------------------------------------ */
/* The trend as an analysis surface                                    */
/* ------------------------------------------------------------------ */

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/** The runs a series has, in order, with where each sits in the dense array. */
const present = (values: readonly (number | null)[]) =>
  values.flatMap((v, i) => (v === null ? [] : [{ i, v }]));

/**
 * The trend with the reader's exclusions taken out. An entry `YYYY-MM-DD`
 * drops that whole run (a runner having a bad night); `tool@YYYY-MM-DD` drops
 * one tool's point on it. Either way the line breaks there -- it is never
 * bridged, so an exclusion cannot pass for a measurement.
 */
export const applyExclusions = <
  P extends {
    readonly date: string;
    readonly byTool: { readonly [tool: string]: number | undefined };
  },
>(
  trend: readonly P[],
  exclude: readonly string[],
): P[] => {
  if (exclude.length === 0) return [...trend];
  const whole = new Set(exclude.filter((e) => !e.includes("@")));
  return trend
    .filter((p) => !whole.has(p.date))
    .map((p) => {
      const tools = exclude.flatMap((e) => {
        const [tool, date] = e.split("@");
        return date === p.date && tool !== undefined ? [tool] : [];
      });
      if (tools.length === 0) return p;
      const byTool = { ...p.byTool };
      for (const tool of tools) delete byTool[tool];
      return { ...p, byTool };
    });
};

/**
 * Runs that sit far from their neighbours: further from the median of the
 * three runs either side than 4 robust standard deviations (1.4826 x MAD)
 * AND than 25% -- so the day-to-day noise of a fast, jittery tool is never
 * flagged. Tuned against the published data: at 10% a 4s tool lit up daily. Each
 * flagged run gets its deviation from that median as a fraction; the rest
 * `null`. A run needs four neighbours to be judged at all.
 */
export const flagOutliers = (values: readonly (number | null)[]): (number | null)[] => {
  const runs = present(values);
  const out: (number | null)[] = values.map(() => null);
  runs.forEach(({ i, v }, at) => {
    const around = [...runs.slice(Math.max(0, at - 3), at), ...runs.slice(at + 1, at + 4)].map(
      (r) => r.v,
    );
    if (around.length < 4) return;
    const m = median(around);
    const mad = median(around.map((x) => Math.abs(x - m)));
    if (m > 0 && Math.abs(v - m) > Math.max(4 * 1.4826 * mad, 0.25 * m)) out[i] = v / m - 1;
  });
  return out;
};

/** The median of each run with up to three runs either side; holes stay holes. */
export const rollingMedian = (values: readonly (number | null)[]): (number | null)[] => {
  const runs = present(values);
  const out: (number | null)[] = values.map(() => null);
  runs.forEach(({ i }, at) => {
    out[i] = median(runs.slice(Math.max(0, at - 3), at + 4).map((r) => r.v));
  });
  return out;
};

/**
 * What changed at run `i`: the median of it and the runs after, against the
 * median of the runs before, `k` each side. `null` with fewer than three on
 * either side -- a step needs a level to step from and to.
 */
export const stepChange = (
  values: readonly (number | null)[],
  i: number,
  k = 5,
): { change: number; before: number; after: number } | null => {
  const runs = present(values);
  const at = runs.findIndex((r) => r.i === i);
  if (at < 0) return null;
  const before = runs.slice(Math.max(0, at - k), at).map((r) => r.v);
  const after = runs.slice(at, at + k).map((r) => r.v);
  if (before.length < 3 || after.length < 3) return null;
  const b = median(before);
  return b > 0
    ? { change: median(after) / b - 1, before: before.length, after: after.length }
    : null;
};

export const METRICS = ["total", "change", "baseline", "per-package"] as const;
export type Metric = (typeof METRICS)[number];

/**
 * The plotted value under each metric, from rows of total seconds (or, for
 * `per-package`, rows the server already built from milliseconds per package).
 *
 *   change    percent against the tool's first run in the window, so every
 *             line starts at 0 and small moves are on one scale
 *   baseline  the tool's time over the baseline's on the same run; only
 *             where both completed -- a ratio against a hole is not drawn
 */
export const metricRows = <R extends { readonly date: string }>(
  rows: readonly R[],
  tools: readonly string[],
  metric: Metric,
  baseline: string | null,
): R[] => {
  if (metric === "total" || metric === "per-package") return [...rows];
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const first = new Map(
    tools.map((t) => [
      t,
      rows.map((r) => num((r as Record<string, unknown>)[t])).find((v) => v !== null) ?? null,
    ]),
  );
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    const base = baseline === null ? null : num((row as Record<string, unknown>)[baseline]);
    for (const tool of tools) {
      const v = num((row as Record<string, unknown>)[tool]);
      const from = first.get(tool) ?? null;
      out[tool] =
        v === null
          ? null
          : metric === "change"
            ? from === null || from <= 0
              ? null
              : (v / from - 1) * 100
            : base === null || base <= 0
              ? null
              : v / base;
    }
    return out as R;
  });
};
