import type { TrendPoint } from "@/lib/load";
import { ratioTo, type CountRow, type FixtureRow, type ToolMean } from "@/lib/measurements";
import { toolColor } from "@/lib/chart-model";
import type { LeaderboardRow } from "@/lib/report";
import { windowChange } from "@/lib/figures";
import { formatDuration, formatVersus } from "@/lib/findings";
import type { SectionId } from "@/lib/sections";
import { fixtureLabel, toolLabel } from "@/lib/tools";
import { DataTable, type Column, type Row } from "@/components/data-table";
import { FixtureName, ToolName } from "@/components/tool-name";
import { SparklineECharts } from "./charts-echarts-dots";

/*
 * The tables' contents, shaped here on the server and handed to the
 * `DataTable` island as cells: what to draw, and what to sort by. Everything
 * honest about a cell -- that a DNF is not a time, that an unpublished count
 * is not a zero -- is decided in this file; the island only orders rows.
 *
 * A tool is named the same way in every table: its brand colour as a swatch
 * (the colour its line and bar are drawn in), its mark, its name.
 */
const MONO = "font-mono text-[0.8125rem]";
const SUB = "mt-0.5 block text-xs text-muted-foreground";

const Tool = ({ tool, section }: { tool: string; section: SectionId }) => (
  <span className="inline-flex items-center gap-2.5 font-medium whitespace-nowrap">
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-sm"
      style={{ background: toolColor(tool) }}
    />
    <ToolName tool={tool} section={section} />
  </span>
);

/** A measurement that is absent, rendered as absent rather than as a zero. */
const Absent = ({ children = "—", title }: { children?: string; title?: string }) => (
  <span className="text-muted-foreground" title={title}>
    {children}
  </span>
);

const toolColumn: Column = { id: "tool", label: "Tool", name: "tool" };

/* ------------------------------------------------------------------ */
/* The ranking                                                         */
/* ------------------------------------------------------------------ */

export const Leaderboard = ({
  section,
  rows: leaderboard,
  runs,
  baseline,
  fixtureCount,
  trendEndsHere,
  hidden,
}: {
  section: SectionId;
  rows: readonly LeaderboardRow[];
  /** How many runs the trend window holds. */
  runs: number;
  baseline: string | null;
  fixtureCount: number;
  /**
   * Whether the trend window ends at the run this table is about. With an
   * exact date range it may not, and "since last run" is then absent.
   */
  trendEndsHere: boolean;
  /**
   * Tools the reader has hidden. Their rows are left out; nothing else moves.
   * A row keeps its rank among ALL tools, and ratios are still taken against
   * the real baseline whether or not its row is showing.
   */
  hidden: readonly string[];
}) => {
  const widest = Math.max(...leaderboard.map((m) => m.mean), 0) || 1;
  const against = baseline === null ? "baseline" : toolLabel(baseline, section);

  const columns: Column[] = [
    { id: "rank", label: "#", name: "rank" },
    toolColumn,
    { id: "mean", label: "Mean", name: "mean time", align: "right" },
    { id: "bar", label: "", name: "mean time" },
    { id: "versus", label: `Against ${against}`, name: "ratio to the baseline", align: "right" },
    { id: "delta", label: "Since last run", name: "change since the last run", align: "right" },
    { id: "trend", label: `${runs} runs in range`, name: "mean time" },
  ];

  const rows: Row[] = leaderboard.flatMap((m): Row[] => {
    if (hidden.includes(m.tool)) return [];
    const { ratio, isBaseline, series } = m;
    const pct = m.sinceLastRun === null ? null : m.sinceLastRun * 100;
    const i = m.rank - 1;

    return [
      {
        id: m.tool,
        cells: {
          rank: { sort: i, node: <span className={`${MONO} text-muted-foreground`}>{i + 1}</span> },
          tool: {
            sort: toolLabel(m.tool, section),
            node: (
              <>
                <Tool tool={m.tool} section={section} />
                {m.version === null ? null : (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{m.version}</span>
                )}
                {m.failed || m.fixtures < fixtureCount ? (
                  <span
                    className="ml-2 text-xs text-absent"
                    title={
                      m.failed
                        ? "A run exited non-zero and is excluded from the mean"
                        : "Did not run on every fixture"
                    }
                  >
                    {m.fixtures}/{fixtureCount} fixtures
                  </span>
                ) : null}
              </>
            ),
          },
          mean: {
            sort: m.mean,
            node: (
              <span className={`${MONO} whitespace-nowrap`}>
                <span className="font-medium">{formatDuration(m.mean)}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ±{(m.rsd * 100).toFixed(1)}%
                </span>
              </span>
            ),
          },
          bar: {
            sort: m.mean,
            node: (
              <span className="mt-1 block w-32">
                <span
                  aria-hidden
                  className={`block h-2.5 rounded-sm ${isBaseline ? "border border-dashed" : ""}`}
                  style={{
                    width: `${Math.max(2, (m.mean / widest) * 100)}%`,
                    ...(isBaseline
                      ? { borderColor: toolColor(m.tool) }
                      : { background: toolColor(m.tool) }),
                  }}
                />
              </span>
            ),
          },
          versus: {
            sort: isBaseline ? 1 : ratio,
            node: (
              <span className={`${MONO} whitespace-nowrap`}>
                {isBaseline ? (
                  <span className="text-muted-foreground">baseline</span>
                ) : ratio === null ? (
                  <Absent title="The baseline was not measured in this scenario" />
                ) : (
                  formatVersus(ratio)
                )}
              </span>
            ),
          },
          delta: {
            sort: pct,
            node: (
              <span className={MONO}>
                {pct === null ? (
                  <Absent
                    title={
                      trendEndsHere
                        ? "No prior run to compare with"
                        : "The chosen date range does not end at this run"
                    }
                  />
                ) : Math.abs(pct) < 0.05 ? (
                  <span className="text-muted-foreground">0.0%</span>
                ) : (
                  <span className={pct < 0 ? "text-better" : "text-worse"}>
                    {pct < 0 ? "−" : "+"}
                    {Math.abs(pct).toFixed(1)}%
                  </span>
                )}
              </span>
            ),
          },
          trend: {
            sort: m.mean,
            node: <SparklineECharts values={series} tool={m.tool} width={108} />,
          },
        },
      },
    ];
  });

  return <DataTable id="ranking" columns={columns} rows={rows} />;
};

/* ------------------------------------------------------------------ */
/* Trend by tool                                                       */
/* ------------------------------------------------------------------ */

/**
 * One card per tool, in the leaderboard's order: its mean on this run, how it
 * moved across the trend window, and the shape of that movement.
 *
 * EACH SPARKLINE IS ON ITS OWN SCALE -- the figure's description says so --
 * so the cards compare a tool with itself, not with its neighbours. The pill
 * is `windowChange`: first run to last run the tool has in the window, and
 * absent with fewer than two. Lower is faster, so a fall is the good colour.
 */
export const TrendByTool = ({
  section,
  means,
  trend,
  hidden,
}: {
  section: SectionId;
  means: readonly ToolMean[];
  trend: readonly TrendPoint[];
  hidden: readonly string[];
}) => (
  /* Registries have long names and six of them: three across, so the names fit. */
  <ul
    className={`grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 ${section === "registries" ? "" : "lg:grid-cols-6"}`}
  >
    {means
      .filter((m) => !hidden.includes(m.tool))
      .map((m) => {
        const series = trend.map((p) => {
          const v = p.byTool[m.tool];
          return typeof v === "number" ? v : null;
        });
        const moved = windowChange(series);
        const pct = moved === null ? null : moved.change * 100;
        return (
          <li key={m.tool} className="flex min-w-0 flex-col rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
              <ToolName
                tool={m.tool}
                section={section}
                className="min-w-0 truncate font-semibold [&>svg]:shrink-0"
              />
              {moved === null || pct === null ? null : (
                <span
                  title={`${trend[moved.from]?.date} to ${trend[moved.to]?.date}`}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.6875rem] whitespace-nowrap tabular-nums ${
                    Math.abs(pct) < 0.05
                      ? "bg-accent text-muted-foreground"
                      : pct < 0
                        ? "bg-better/10 text-better"
                        : "bg-worse/10 text-worse"
                  }`}
                >
                  {Math.abs(pct) < 0.05 ? null : (
                    <span className="mr-1 text-[0.5rem]">{pct < 0 ? "▼" : "▲"}</span>
                  )}
                  {Math.abs(pct).toFixed(1)}%
                </span>
              )}
            </div>
            <p className="mt-2 mb-3 font-mono text-lg font-medium tabular-nums">
              {formatDuration(m.mean)}
            </p>
            <div className="mt-auto">
              <SparklineECharts values={series} tool={m.tool} height={36} accent />
            </div>
          </li>
        );
      })}
  </ul>
);

/* ------------------------------------------------------------------ */
/* Tools by fixture                                                    */
/* ------------------------------------------------------------------ */

export const PerFixtureTable = ({
  id,
  section,
  rows: fixtureRows,
  fixtures,
  order,
  baseline,
  unit,
  hidden,
}: {
  /** Names the table in the `sort` parameter. */
  id: string;
  section: SectionId;
  rows: readonly FixtureRow[];
  fixtures: readonly string[];
  /** Row order: the ranking's, so every table on the page opens the same way. */
  order: readonly string[];
  baseline: string | null;
  /* The unit, not a formatter: this crosses into a client island. */
  unit: "s" | "ms";
  /** Hidden tools lose their row. "Fastest" and the ratios still count them. */
  hidden: readonly string[];
}) => {
  const present = new Set(
    fixtureRows.flatMap((r) => [...r.values.map((v) => v.tool), ...r.failed]),
  );
  const tools = [
    ...order.filter((t) => present.has(t)),
    ...[...present].filter((t) => !order.includes(t)),
  ].filter((t) => !hidden.includes(t));
  const row = (fixture: string) => fixtureRows.find((r) => r.fixture === fixture);
  const lookup = (fixture: string, tool: string): number | undefined =>
    row(fixture)?.values.find((v) => v.tool === tool)?.value;
  const fastest = (fixture: string): number | undefined => {
    const values = row(fixture)?.values.map((v) => v.value) ?? [];
    return values.length === 0 ? undefined : Math.min(...values);
  };
  const format = (v: number): string =>
    unit === "ms" ? `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}ms` : formatDuration(v);

  const columns: Column[] = [
    toolColumn,
    ...fixtures.map((f): Column => ({
      id: f,
      label: <FixtureName fixture={f} />,
      name: fixtureLabel(f),
      align: "right",
    })),
  ];

  const rows: Row[] = tools.map((tool) => ({
    id: tool,
    cells: {
      tool: { sort: toolLabel(tool, section), node: <Tool tool={tool} section={section} /> },
      ...Object.fromEntries(
        fixtures.map((f) => {
          const v = lookup(f, tool);
          const reference = baseline === null ? undefined : lookup(f, baseline);
          const ratio = v === undefined ? null : ratioTo(v, reference);
          return [
            f,
            {
              // An absent or failed run has no sort value, so it sorts last
              // in both directions rather than as the smallest time.
              sort: v ?? null,
              node:
                v === undefined ? (
                  row(f)?.failed.includes(tool) ? (
                    <span className={`${MONO} text-worse`} title="The run exited non-zero">
                      DNF
                    </span>
                  ) : (
                    <Absent title="Not run on this fixture" />
                  )
                ) : (
                  <span className={MONO}>
                    <span className={v === fastest(f) ? "font-semibold" : ""}>{format(v)}</span>
                    <span className={`${SUB} font-sans`}>
                      {tool === baseline ? "baseline" : ratio === null ? " " : formatVersus(ratio)}
                    </span>
                  </span>
                ),
            },
          ];
        }),
      ),
    },
  }));

  return <DataTable id={id} columns={columns} rows={rows} />;
};

/* ------------------------------------------------------------------ */
/* Counts                                                              */
/* ------------------------------------------------------------------ */

export const CountTable = ({
  id,
  section,
  rows: countRows,
  fixtures,
  empty,
  hidden,
}: {
  id: string;
  section: SectionId;
  rows: readonly CountRow[];
  fixtures: readonly string[];
  empty: string;
  hidden: readonly string[];
}) => {
  if (countRows.length === 0) return <p className="p-6 text-sm text-absent">{empty}</p>;

  const columns: Column[] = [
    toolColumn,
    ...fixtures.map((f): Column => ({
      id: f,
      label: <FixtureName fixture={f} />,
      name: fixtureLabel(f),
      align: "right",
    })),
    { id: "total", label: "Total", name: "total", align: "right" },
  ];

  const rows: Row[] = countRows
    .filter((r) => !hidden.includes(r.tool))
    .map((r) => ({
      id: r.tool,
      cells: {
        tool: { sort: toolLabel(r.tool, section), node: <Tool tool={r.tool} section={section} /> },
        ...Object.fromEntries(
          fixtures.map((f) => {
            const count = r.byFixture[f];
            const range = r.ranges[f];
            return [
              f,
              {
                sort: count ?? null,
                node:
                  count === undefined ? (
                    <Absent title="No count published" />
                  ) : (
                    <span className={MONO}>
                      {count.toLocaleString("en-US")}
                      {range === undefined ? null : (
                        <span className={SUB}>
                          {range[0].toLocaleString("en-US")}–{range[1].toLocaleString("en-US")}
                        </span>
                      )}
                    </span>
                  ),
              },
            ];
          }),
        ),
        total: {
          sort: r.total,
          node: <span className={`${MONO} font-medium`}>{r.total.toLocaleString("en-US")}</span>,
        },
      },
    }));

  return <DataTable id={id} columns={columns} rows={rows} />;
};
