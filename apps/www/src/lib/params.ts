/**
 * Every query parameter the site reads, defined once.
 *
 * One definition per parameter -- its URL key, its parser and its default --
 * shared by the server (which loads them), the links (which serialise them)
 * and the client islands (which read and write them through nuqs). A copied
 * URL reproduces what was on screen, and a default is never written to it, so
 * a plain link stays plain.
 *
 * Two kinds, and the split is by what a change has to do:
 *
 *   SERVER    changes what the server fetches or shapes. Written as real
 *             links, so a change is a navigation and the page re-renders.
 *   CLIENT    changes only how an island draws data it already has. Written
 *             with `useQueryState`, shallow: the URL updates, nothing refetches.
 *
 * Path segments are not here. `/{section}/{scenario}` stays in the path.
 *
 * A parser can only say a value is well-formed. Whether it NAMES anything --
 * a fixture this scenario published, a tool these files contain, a column
 * this table has -- depends on the data, so each reader checks against what
 * it actually holds and falls back to the default.
 */
import {
  createLoader,
  createSerializer,
  parseAsArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { METRICS } from "./figures";

/** Trend windows, in calendar days ending at the run being shown. */
export const RANGES = [30, 60, 90, 120] as const;
export const SCALES = ["linear", "log"] as const;
export const SMOOTHING = ["off", "median7"] as const;
export const GAPS = ["connect", "hole"] as const;

export const reportParams = {
  /** SERVER. A published date; absent means the latest. */
  date: parseAsString,
  /** SERVER. One fixture; absent means all of them, averaged. */
  fixture: parseAsString,
  /** SERVER. A preset trend window: this many days, ending at the run shown. */
  range: parseAsNumberLiteral(RANGES).withDefault(30),
  /** SERVER. An exact trend window. Both must be published dates; see `trendWindow`. */
  from: parseAsString,
  to: parseAsString,
  /**
   * SERVER. Tools hidden from every figure and table. One parameter, written
   * by the tools menu and by the trend legend alike. It lists what is
   * hidden, so the default -- everything shown -- is empty and out of the URL.
   */
  hide: parseAsArrayOf(parseAsString).withDefault([]),
  /** CLIENT. The trend's value axis. */
  scale: parseAsStringLiteral(SCALES).withDefault("linear"),
  /** CLIENT. The run pinned on the trend; a date with no loaded run pins nothing. */
  at: parseAsString,
  /** CLIENT. One `table.column.direction` entry per sorted table. */
  sort: parseAsArrayOf(parseAsString).withDefault([]),
  /**
   * SERVER. What the trend plots. Total time is the measurement; the others
   * are derived from it and say so wherever they are drawn. The package-count
   * files `per-package` needs are fetched wherever a scenario publishes them:
   * the per-package figure by fixture draws every run.
   */
  metric: parseAsStringLiteral(METRICS).withDefault("total"),
  /**
   * SERVER. Runs taken out of every trend: `YYYY-MM-DD` for a whole run,
   * `tool@YYYY-MM-DD` for one tool's point. Visible and reversible on the
   * page; the run being shown cannot be excluded.
   */
  exclude: parseAsArrayOf(parseAsString).withDefault([]),
  /** CLIENT. A rolling median drawn over the trend's lines. */
  smooth: parseAsStringLiteral(SMOOTHING).withDefault("off"),
  /**
   * CLIENT. What the trend draws across a run a tool has no time for (a day
   * nothing ran, a DNF): a dotted bridge from the run before to the run after
   * (the default), or a hole. The line itself never joins across one.
   */
  gaps: parseAsStringLiteral(GAPS).withDefault("connect"),
  /**
   * CLIENT. The trend's value-axis zoom: `fit`, or `lo~hi` in the plotted
   * metric's units. Read through `parseValueRange`; a bad value zooms nothing.
   */
  y: parseAsString,
  /**
   * SERVER. The trend brush's selection, `YYYY-MM-DD~YYYY-MM-DD`: a focus
   * inside the loaded window, not a new window. The chart keeps everything it
   * loaded and opens its brush on the focus; the page's other trends (Trend
   * by tool, the leaderboard's sparklines) are computed over it. Ignored unless
   * both ends are runs in the window, in order.
   */
  focus: parseAsString,
};

export const loadReportParams = createLoader(reportParams);
export const reportHref = createSerializer(reportParams);

/* ------------------------------------------------------------------ */
/* Table sort entries                                                  */
/* ------------------------------------------------------------------ */

export interface TableSort {
  readonly column: string;
  readonly direction: "asc" | "desc";
}

/**
 * The sort for one table, out of the `sort` entries.
 *
 * `null` -- the table's own order -- unless there is an entry for this table
 * naming a column it actually has. A column id may itself contain dots (a
 * fixture name can), so the table id is taken from the front and the
 * direction from the back.
 */
export const tableSortOf = (
  entries: readonly string[],
  table: string,
  columns: readonly string[],
): TableSort | null => {
  for (const entry of entries) {
    if (!entry.startsWith(`${table}.`)) continue;
    const rest = entry.slice(table.length + 1);
    const cut = rest.lastIndexOf(".");
    if (cut <= 0) continue;
    const column = rest.slice(0, cut);
    const direction = rest.slice(cut + 1);
    if (!columns.includes(column)) continue;
    if (direction !== "asc" && direction !== "desc") continue;
    return { column, direction };
  }
  return null;
};

/** The entries with this table's sort replaced, or removed when `null`. */
export const withTableSort = (
  entries: readonly string[],
  table: string,
  sort: TableSort | null,
): string[] => [
  ...entries.filter((entry) => !entry.startsWith(`${table}.`)),
  ...(sort === null ? [] : [`${table}.${sort.column}.${sort.direction}`]),
];

/* ------------------------------------------------------------------ */
/* The trend window                                                    */
/* ------------------------------------------------------------------ */

/** The longest window offered: the span that can be spaced by calendar date. */
export const MAX_WINDOW_DAYS = 120;

const DAY = 86_400_000;
const day = (date: string): number => Date.parse(`${date}T00:00:00Z`);

export interface TrendWindow {
  /** The published dates inside the window, ascending. */
  readonly dates: readonly string[];
  /** True when `from`/`to` were honoured; false when a preset was used. */
  readonly custom: boolean;
  readonly from: string;
  readonly to: string;
}

/**
 * Which published dates the trend covers.
 *
 * An exact window is honoured only if it can be: both ends are dates the
 * archive actually published (a range cannot start or end on a hole), `from`
 * is not after `to`, `to` is not after the run being shown, and the span is
 * within {@link MAX_WINDOW_DAYS}. Anything else -- a hand-edited URL, a link
 * that outlived its dates -- falls back to the preset rather than to an empty
 * chart or an error.
 */
export const trendWindow = ({
  dates,
  end,
  range,
  from,
  to,
}: {
  /** Every published date, ascending. */
  readonly dates: readonly string[];
  /** The run the report is showing. */
  readonly end: string;
  readonly range: number;
  readonly from: string | null;
  readonly to: string | null;
}): TrendWindow => {
  if (
    from !== null &&
    to !== null &&
    dates.includes(from) &&
    dates.includes(to) &&
    from <= to &&
    to <= end &&
    (day(to) - day(from)) / DAY < MAX_WINDOW_DAYS
  ) {
    return { dates: dates.filter((d) => d >= from && d <= to), custom: true, from, to };
  }
  const inRange = dates.filter((d) => {
    if (d > end) return false;
    const age = (day(end) - day(d)) / DAY;
    return Number.isFinite(age) && age < Math.min(range, MAX_WINDOW_DAYS);
  });
  return { dates: inRange, custom: false, from: inRange[0] ?? end, to: end };
};
