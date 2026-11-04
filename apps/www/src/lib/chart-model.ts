/**
 * The honesty layer for charts — pure, engine-agnostic, and tested.
 *
 * Everything in this file exists so that the behaviours below survive a change
 * of rendering engine. They were won expensively (a sentinel ranked a crashed
 * tool first; an invalid SVG path hid a series silently) and a preset ships
 * none of them.
 *
 * The rule the module enforces: **a value that was not measured is `undefined`,
 * never `0` and never interpolated.** Every consumer — hand-built SVG today,
 * Recharts after the retrofit — receives date-aligned arrays with holes in
 * them and must render the holes as holes.
 */
import type { TrendPoint } from "./load";

/** All a chart row needs of a trend point: its date and the plotted means. */
type Plotted = Pick<TrendPoint, "date" | "byTool">;

/* ------------------------------------------------------------------ */
/* Scales                                                              */
/* ------------------------------------------------------------------ */

/**
 * Axis ticks for a non-negative magnitude.
 *
 * Returns `[0]` rather than throwing or producing `Infinity` steps when the
 * maximum is absent or non-positive, which happens whenever every value in a
 * scenario was excluded as unusable.
 */
export const niceTicks = (max: number, count = 4): number[] => {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t);
  return ticks;
};

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

/** A run of consecutive slots that all have values. */
export interface Segment {
  readonly from: number;
  readonly to: number;
}

/**
 * Split a date-aligned series into the runs that actually have values.
 *
 * This is the engine-agnostic statement of "do not draw through a gap". The
 * archive is missing 53 calendar days — the widest run is 11, between the
 * consecutive published dates 2026-06-17 and 2026-06-29 — so a line drawn
 * straight across asserts measurements nobody published. A connected line
 * through a gap looks *better*, not broken, which is why this is tested rather
 * than left to the renderer's defaults.
 */
export const segments = (values: readonly (number | undefined)[]): Segment[] => {
  const out: Segment[] = [];
  let start: number | null = null;
  values.forEach((v, i) => {
    const ok = typeof v === "number" && Number.isFinite(v);
    if (ok && start === null) start = i;
    if (!ok && start !== null) {
      out.push({ from: start, to: i - 1 });
      start = null;
    }
  });
  if (start !== null) out.push({ from: start, to: values.length - 1 });
  return out;
};

/**
 * An SVG path that breaks at gaps.
 *
 * Starts every run with `M`. A series whose first slot is empty previously
 * emitted a path beginning with `L`, which is invalid SVG: the browser drops
 * the element and the series simply vanishes, which reads as "no data for this
 * tool" rather than as a bug.
 */
export const gappedPath = (
  values: readonly (number | undefined)[],
  x: (i: number) => number,
  y: (v: number) => number,
): string =>
  segments(values)
    .map((seg) => {
      const parts: string[] = [];
      for (let i = seg.from; i <= seg.to; i++) {
        const v = values[i] as number;
        parts.push(`${i === seg.from ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      }
      return parts.join(" ");
    })
    .join(" ");

/* ------------------------------------------------------------------ */
/* Series                                                              */
/* ------------------------------------------------------------------ */

/**
 * One tool's values across the trend window, **aligned to the dates**.
 *
 * The array has one slot per published run in range, with `undefined` where
 * the tool has no usable value. Filtering the holes out instead would slide
 * later runs leftward and misdate the shape of the line — the series would
 * still look plausible, which is what makes it dangerous.
 */
export const alignedSeries = (points: readonly Plotted[], tool: string): (number | undefined)[] =>
  points.map((p) => p.byTool[tool]);

/** Rows for a Recharts-style data array: one object per date, holes as `null`. */
export const toChartRows = (
  points: readonly Plotted[],
  tools: readonly string[],
): { date: string; [tool: string]: string | number | null }[] =>
  points.map((p) => {
    const row: { date: string; [tool: string]: string | number | null } = { date: p.date };
    for (const tool of tools) {
      const v = p.byTool[tool];
      // `null`, not `0` and not omitted: charting engines read null as a break
      // and 0 as a measurement.
      row[tool] = typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    return row;
  });

/* ------------------------------------------------------------------ */
/* Per-fixture spread                                                  */
/* ------------------------------------------------------------------ */

export interface Spread {
  readonly fastest: { readonly tool: string; readonly value: number } | null;
  readonly slowest: { readonly tool: string; readonly value: number } | null;
  /** `null` when it cannot be computed rather than a misleading 1. */
  readonly ratio: number | null;
}

export const spreadOf = (
  values: readonly { readonly tool: string; readonly value: number }[],
): Spread => {
  const usable = values
    .filter((v) => Number.isFinite(v.value) && v.value > 0)
    .sort((a, b) => a.value - b.value);
  const fastest = usable[0] ?? null;
  const slowest = usable.at(-1) ?? null;
  return {
    fastest,
    slowest,
    ratio:
      fastest !== null && slowest !== null && fastest.value > 0
        ? slowest.value / fastest.value
        : null,
  };
};

/* ------------------------------------------------------------------ */
/* Dense rows — calendar gaps become real holes                        */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;

/**
 * Cap on densification: about three years, so the whole archive (440 days and
 * growing) is spaced by calendar time on every window, All time included. A
 * row per day is cheap at this size; past it the fallback below takes over.
 */
export const MAX_DENSE_DAYS = 1100;

/**
 * Rows covering every calendar day between the first and last published run.
 *
 * This is how a calendar gap becomes visible. With one row per *published*
 * date, 2026-06-17 and 2026-06-29 are adjacent slots and the chart draws them
 * one step apart — identical to two consecutive days, with eleven missing days
 * silently asserted to be a regular cadence. Emitting a row per calendar day
 * turns the gap into eleven `null`s, which the renderer already knows how to
 * break across: the same mechanism that handles a tool with no value, rather
 * than a second concept.
 *
 * Falls back to one row per published date when the span is longer than
 * {@link MAX_DENSE_DAYS}. That fallback is honest-but-compressed, so callers
 * get `dense: false` and can say so rather than imply even spacing.
 */
export const toDenseChartRows = (
  points: readonly Plotted[],
  tools: readonly string[],
): {
  rows: { date: string; [tool: string]: string | number | null }[];
  dense: boolean;
  spanDays: number;
} => {
  const sparse = toChartRows(points, tools);
  if (points.length < 2) return { rows: sparse, dense: true, spanDays: 0 };

  const first = Date.parse(`${points[0]?.date}T00:00:00Z`);
  const last = Date.parse(`${points.at(-1)?.date}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) {
    return { rows: sparse, dense: false, spanDays: 0 };
  }

  const spanDays = Math.round((last - first) / DAY) + 1;
  if (spanDays > MAX_DENSE_DAYS) return { rows: sparse, dense: false, spanDays };

  const byDate = new Map(sparse.map((r) => [r.date, r]));
  const rows: { date: string; [tool: string]: string | number | null }[] = [];
  for (let t = first; t <= last; t += DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    const existing = byDate.get(date);
    if (existing !== undefined) {
      rows.push(existing);
      continue;
    }
    const blank: { date: string; [tool: string]: string | number | null } = { date };
    for (const tool of tools) blank[tool] = null;
    rows.push(blank);
  }
  return { rows, dense: true, spanDays };
};

/** One row of a trend chart: a date and each tool's value, `null` for a hole. */
export type ChartRow = { date: string; [tool: string]: string | number | null };

/**
 * Dense rows, by column: what the server sends a chart island instead of one
 * object per calendar day with every tool's key repeated. Lossless -- the
 * values are the rows' own, unrounded -- and `rowsOf` turns it back into
 * exactly those rows, so the charts' internals never see the difference.
 */
export interface DenseSeries {
  /** First calendar day, YYYY-MM-DD. Index i is start + i days. */
  readonly start: string;
  /** Calendar days covered; every array below has this length. */
  readonly length: number;
  /** False past MAX_DENSE_DAYS: then `dates` lists each index's day (the sparse fallback). */
  readonly dense: boolean;
  readonly dates?: readonly string[];
  /** One column per tool, null for a hole (never 0). */
  readonly values: { readonly [tool: string]: readonly (number | null)[] };
}

/** `toDenseChartRows`, by column. */
export const toDenseSeries = (
  points: readonly Plotted[],
  tools: readonly string[],
): DenseSeries => {
  const { rows, dense } = toDenseChartRows(points, tools);
  /* Dense rows are consecutive days, so their dates are implied. */
  const implied = dense && rows.length > 0;
  return {
    start: rows[0]?.date ?? "",
    length: rows.length,
    dense: implied,
    ...(implied ? {} : { dates: rows.map((r) => r.date) }),
    values: Object.fromEntries(
      tools.map((tool) => [tool, rows.map((r) => (typeof r[tool] === "number" ? r[tool] : null))]),
    ),
  };
};

/** The rows a `DenseSeries` encodes: `toDenseChartRows(points, tools).rows`, exactly. */
export const rowsOf = (series: DenseSeries): ChartRow[] => {
  const first = Date.parse(`${series.start}T00:00:00Z`);
  const columns = Object.entries(series.values);
  return Array.from({ length: series.length }, (_, i) => {
    const date = series.dense
      ? new Date(first + i * DAY).toISOString().slice(0, 10)
      : (series.dates?.[i] ?? "");
    const row: ChartRow = { date };
    for (const [tool, column] of columns) row[tool] = column[i] ?? null;
    return row;
  });
};

/** What a chart island needs of each run besides its plotted values. */
export type TrendRun = Pick<
  TrendPoint,
  "date" | "fixtures" | "partial" | "failed" | "byFixture" | "rsd" | "rsdByFixture"
>;

type Column = readonly (number | null)[];

/**
 * Each run's detail, by column: what the server sends instead of one object
 * per run with every tool and fixture key repeated. The per-fixture seconds
 * and spreads are most of a long trend's bytes, so they become one column per
 * (tool, fixture) over the runs, `null` where that run has no value. Partial
 * and failed are sparse and stay per run. Lossless -- nothing is rounded --
 * and `trendOf` gives back the runs.
 */
export interface TrendColumns {
  readonly dates: readonly string[];
  /** Every fixture any run published, in first-seen order. */
  readonly fixtures: readonly string[];
  /** Which of `fixtures` each run published, by index, in the run's own order. */
  readonly published: readonly (readonly number[])[];
  readonly partial: readonly TrendRun["partial"][];
  readonly failed: readonly TrendRun["failed"][];
  readonly rsd: { readonly [tool: string]: Column };
  readonly byFixture: { readonly [tool: string]: { readonly [fixture: string]: Column } };
  readonly rsdByFixture: { readonly [tool: string]: { readonly [fixture: string]: Column } };
}

/** The runs' detail by column. */
export const toTrendColumns = (runs: readonly TrendRun[]): TrendColumns => {
  const fixtures = [...new Set(runs.flatMap((r) => r.fixtures))];
  const nested = (
    pick: (r: TrendRun) => { readonly [tool: string]: { readonly [fixture: string]: number } },
  ) => {
    const out: { [tool: string]: { [fixture: string]: (number | null)[] } } = {};
    runs.forEach((run, i) => {
      for (const [tool, byFixture] of Object.entries(pick(run))) {
        for (const [fixture, value] of Object.entries(byFixture)) {
          ((out[tool] ??= {})[fixture] ??= Array.from({ length: runs.length }, () => null))[i] =
            value;
        }
      }
    });
    return out;
  };
  const rsd: { [tool: string]: (number | null)[] } = {};
  runs.forEach((run, i) => {
    for (const [tool, value] of Object.entries(run.rsd)) {
      (rsd[tool] ??= Array.from({ length: runs.length }, () => null))[i] = value;
    }
  });
  return {
    dates: runs.map((r) => r.date),
    fixtures,
    published: runs.map((r) => r.fixtures.map((f) => fixtures.indexOf(f))),
    partial: runs.map((r) => r.partial),
    failed: runs.map((r) => r.failed),
    rsd,
    byFixture: nested((r) => r.byFixture),
    rsdByFixture: nested((r) => r.rsdByFixture),
  };
};

/** The runs a `TrendColumns` encodes: a tool or fixture with no value on a run is absent, as it was. */
export const trendOf = (columns: TrendColumns): TrendRun[] => {
  const unnest = (
    by: TrendColumns["byFixture"],
    i: number,
  ): { [tool: string]: { [fixture: string]: number } } => {
    const out: { [tool: string]: { [fixture: string]: number } } = {};
    for (const [tool, byFixture] of Object.entries(by)) {
      for (const [fixture, column] of Object.entries(byFixture)) {
        const value = column[i];
        if (typeof value === "number") (out[tool] ??= {})[fixture] = value;
      }
    }
    return out;
  };
  return columns.dates.map((date, i) => ({
    date,
    fixtures: (columns.published[i] ?? []).map((f) => columns.fixtures[f] ?? ""),
    partial: columns.partial[i] ?? {},
    failed: columns.failed[i] ?? {},
    byFixture: unnest(columns.byFixture, i),
    rsd: Object.fromEntries(
      Object.entries(columns.rsd).flatMap(([tool, column]) => {
        const value = column[i];
        return typeof value === "number" ? [[tool, value]] : [];
      }),
    ),
    rsdByFixture: unnest(columns.rsdByFixture, i),
  }));
};

/* ------------------------------------------------------------------ */
/* Presentation tokens shared by every chart                           */
/* ------------------------------------------------------------------ */

/**
 * A tool's colour from the categorical ramp.
 *
 * Falls back to `--color-muted-foreground` for a name the ramp does not cover. The
 * ramp is defined in a plain `:root` block rather than in `@theme` -- Tailwind
 * tree-shakes theme variables no utility references, which silently emptied
 * this ramp in light mode. See `globals.css`.
 */
export const toolColor = (tool: string): string =>
  `var(--color-tool-${tool}, var(--color-muted-foreground))`;
