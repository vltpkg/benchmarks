/**
 * A report as Markdown, for agents: the page's numbers as tables, its trend as
 * CSV, its caveats written out. Built from the same `ReportModel` the page
 * draws, so the two cannot disagree.
 */
import type { History } from "./api";
import { citation } from "./cite";
import {
  fixtureBars,
  flagOutliers,
  metricRows,
  windowChange,
  type Bar,
  type Metric,
} from "./figures";
import { formatDuration, formatVersus } from "./findings";
import { formatMs, type CountRow, type FixtureRow } from "./measurements";
import { METHOD, RESOURCES, RUNNER, RUNNER_NOTE } from "./metadata";
import { rowsOf } from "./chart-model";
import { rangeLabel, reportHref } from "./params";
import type { TrendPoint } from "./load";
import type { ReportModel } from "./report";
import type { VersionMarker } from "./version-markers";
import { SECTION_DEFS, type SectionId } from "./sections";
import { fixtureLabel, toolLabel } from "./tools";

/** How each trend metric is named in the filter list and described above the CSV. */
const METRIC_TEXT: { readonly [M in Metric]: { readonly name: string; readonly unit: string } } = {
  total: { name: "total time", unit: "" },
  "per-package": {
    name: "per-package time (derived)",
    unit: "Milliseconds per installed package (derived)",
  },
  change: {
    name: "change since the first run in the window (derived)",
    unit: "Percent change from each tool's first run in the window (derived)",
  },
  baseline: {
    name: "time relative to the baseline (derived)",
    unit: "Each tool's time as a multiple of the baseline's on the same run (derived)",
  },
};

/*
 * How long a CDN keeps a page's Markdown twin (`publicCache` in each route's
 * markdown.ts): an hour fresh, and at most an hour more served stale while it
 * revalidates. The data changes nightly (and on a reprocess), so a twin trails
 * its page by an hour or two after a run, never the day `'hours'` would allow.
 * A deploy purges the CDN.
 */
export const TWIN_CACHE = { revalidate: 3600, expire: 7200 };

/** The view the report describes, with only the selections it honoured. */
export const viewHref = (report: ReportModel): string => {
  const { filters } = report;
  return reportHref(report.path, {
    date: filters.date,
    fixture: filters.fixture,
    range: filters.window.custom ? null : filters.range,
    from: filters.window.custom ? filters.window.from : null,
    to: filters.window.custom ? filters.window.to : null,
    hide: [...filters.hide],
    metric: filters.metric,
    exclude: [...filters.exclude],
  });
};

/** A number with at most three decimals, as a table or CSV cell. */
const num = (n: number): string => String(Number(n.toFixed(3)));

const percent = (fraction: number): string => {
  const pct = fraction * 100;
  return Math.abs(pct) < 0.05 ? "0.0%" : `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
};

const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`),
  ].join("\n");

const perFixture = (report: ReportModel, rows: readonly FixtureRow[]): string => {
  const tools = report.leaderboard.map((r) => r.tool);
  const present = [
    ...tools,
    ...report.unranked,
    ...new Set(rows.flatMap((r) => [...r.values.map((v) => v.tool), ...r.failed])),
  ].filter((t, i, all) => all.indexOf(t) === i && !report.filters.hide.includes(t));
  return table(
    ["Tool", ...report.fixtures.map(fixtureLabel)],
    present.map((tool) => [
      label(report, tool),
      ...report.fixtures.map((f) => {
        const row = rows.find((r) => r.fixture === f);
        const v = row?.values.find((x) => x.tool === tool)?.value;
        return v !== undefined ? num(v) : row?.failed.includes(tool) ? "DNF" : "—";
      }),
    ]),
  );
};

const counts = (report: ReportModel, rows: readonly CountRow[]): string =>
  table(
    ["Tool", ...report.fixtures.map(fixtureLabel), "Total"],
    rows
      .filter((r) => !report.filters.hide.includes(r.tool))
      .map((r) => [
        label(report, r.tool),
        ...report.fixtures.map((f) => {
          const count = r.byFixture[f];
          const range = r.ranges[f];
          if (count === undefined) return "—";
          return range === undefined ? String(count) : `${count} (${range[0]}–${range[1]})`;
        }),
        String(r.total),
      ]),
  );

/*
 * How a trend's CSV is laid out: a row a calendar day, or -- past
 * MAX_DENSE_DAYS, where the chart stops spacing runs by date -- a row a run.
 */
const layout = (perDay: boolean) =>
  perDay
    ? { rows: "one row per calendar day", row: "day" }
    : { rows: "one row per run (the window is too long for a row a day)", row: "run" };

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const DAY_MS = 86_400_000;

/* Whether a history's rows are consecutive days, as a dense series' are. */
const perDay = (rows: readonly { readonly date: string }[]): boolean =>
  rows.every(
    (r, i) => i === 0 || Date.parse(r.date) - Date.parse(rows[i - 1]?.date ?? "") === DAY_MS,
  );

const label = (report: ReportModel, tool: string): string =>
  report.leaderboard.find((r) => r.tool === tool)?.label ?? tool;

/**
 * The trend as agents read it best: a CSV block, one row per calendar day
 * (or per run, past MAX_DENSE_DAYS) with empty cells for gaps, then the DNFs, coverage, version changes and
 * outliers that explain them.
 */
const trendLines = ({
  rows,
  runs,
  markers,
  outliers,
  tools,
  fixtureCount,
  label,
  level = "###",
}: {
  /** The heading level of the notes under the CSV: one below the trend's own. */
  level?: string;
  rows: readonly { readonly date: string; readonly [tool: string]: string | number | null }[];
  runs: readonly Pick<TrendPoint, "date" | "fixtures" | "failed">[];
  markers: readonly VersionMarker[];
  outliers: readonly { tool: string; date: string; deviation: number }[];
  tools: readonly string[];
  fixtureCount: number;
  label: (tool: string) => string;
}): string[] => {
  const lines = [
    "```csv",
    ["date", ...tools].join(","),
    ...rows.map((row) =>
      [row.date, ...tools.map((t) => (typeof row[t] === "number" ? num(row[t]) : ""))].join(","),
    ),
    "```",
    "",
  ];
  const dnf = new Map<string, { dates: string[]; exits: Set<number> }>();
  for (const p of runs) {
    for (const [tool, failed] of Object.entries(p.failed)) {
      if (!tools.includes(tool)) continue;
      for (const r of failed) {
        const entry = dnf.get(`${tool}\t${r.fixture}`) ?? { dates: [], exits: new Set() };
        entry.dates.push(p.date);
        if (Number.isFinite(r.exit)) entry.exits.add(r.exit);
        dnf.set(`${tool}\t${r.fixture}`, entry);
      }
    }
  }
  const failures = [
    ...[...dnf].map(([key, { dates, exits }]) => {
      const [tool = "", fixture = ""] = key.split("\t");
      return `- ${label(tool)} on ${fixtureLabel(fixture)}: DNF on ${dates.length} ${dates.length === 1 ? "run" : "runs"}${exits.size === 0 ? "" : ` (exit ${[...exits].join(", ")})`}: ${dates.join(", ")}`;
    }),
    ...runs
      .filter((p) => p.fixtures.length < fixtureCount)
      .map((p) => `- ${p.date}: ${p.fixtures.length} of ${fixtureCount} fixtures published`),
  ];
  if (failures.length > 0) lines.push(`${level} DNF and coverage`, "", ...failures, "");
  const changes = markers.filter((m) => tools.includes(m.tool));
  if (changes.length > 0) {
    lines.push(
      `${level} Version changes`,
      "",
      "Observed between consecutive published runs; a missing marker is not evidence that nothing changed.",
      "",
      ...changes.map(
        (m) =>
          `- ${m.date}: ${label(m.tool)} ${m.kind === "added" ? `added at ${m.version}` : `${m.previous} → ${m.version}`}`,
      ),
      "",
    );
  }
  const flagged = outliers
    .filter((o) => tools.includes(o.tool))
    .toSorted((x, y) => x.date.localeCompare(y.date));
  if (flagged.length > 0) {
    lines.push(
      `${level} Flagged outliers`,
      "",
      "Runs far from the median of their neighbours (more than 4 robust standard deviations and 25%).",
      "",
      ...flagged.map(
        (o) => `- ${o.date}: ${label(o.tool)}, ${percent(o.deviation)} from its neighbours`,
      ),
      "",
    );
  }
  return lines;
};

/** Each figure of a report as Markdown lines, by its id on the page. */
export type FigureMarkdown = { readonly [figure: string]: readonly string[] };

/**
 * Each figure of the report as Markdown, keyed by its id on the page
 * (`outline`), without the figure's own heading: each chart as the numbers it
 * draws, each table as a table. `reportMarkdown` sets them under the page's
 * headings; the page's Markdown twin (app/[section]/[[...params]]/markdown.ts)
 * fills each figure's `<AgentSlot>` with its own, under the heading the page
 * renders.
 */
export const figureMarkdown = (report: ReportModel, origin: string): FigureMarkdown => {
  const abs = (path: string) => new URL(path, origin).href;
  const { section, scenario, filters, trend } = report;
  const metric: Metric = filters.metric === "per-package" ? trend.plotted : filters.metric;
  const fixtureCount = report.fixtures.length;
  const against = report.baseline === null ? "the baseline" : label(report, report.baseline);
  const shown = (tool: string) => !filters.hide.includes(tool);
  const tools = [...report.ranked, ...report.unranked].filter(shown);
  const fmt = (unit: "s" | "ms", v: number) =>
    unit === "s" ? formatDuration(v) : `${formatMs(v)}ms`;
  const versus = (tool: string, value: number, reference: number | undefined) =>
    tool === report.baseline
      ? "baseline"
      : reference === undefined
        ? "—"
        : formatVersus(reference / value);
  /* A bar chart as a table: its tools in its order, each with its value and multiple. */
  const barTable = (bars: readonly Bar[], unit: "s" | "ms", reference: number | undefined) =>
    table(
      ["Tool", unit === "s" ? "Time" : "Per package", `Against ${against}`],
      bars
        .filter((b) => shown(b.tool))
        .map((b) => [
          label(report, b.tool),
          fmt(unit, b.value),
          versus(b.tool, b.value, reference),
        ]),
    );
  const grid = layout(trend.series.dense);
  const timeReference = report.timeBars.bars.find((b) => b.tool === report.baseline)?.value;
  const ppReference = report.perPackageBars.bars.find((b) => b.tool === report.baseline)?.value;

  return {
    "leaderboard-table": [
      `Ranked by mean ${report.measure} time; lower is faster. ±RSD is the pooled relative standard deviation. Since last run compares with the previous run in the trend window.`,
      "",
      table(
        [
          "#",
          "Tool",
          "Key",
          "Mean (s)",
          "±RSD",
          `Against ${against}`,
          "Since last run",
          "Fixtures",
          "Version",
        ],
        report.leaderboard
          .filter((r) => !filters.hide.includes(r.tool))
          .map((r) => [
            String(r.rank),
            r.label,
            r.tool,
            num(r.mean),
            `${(r.rsd * 100).toFixed(1)}%`,
            r.isBaseline ? "baseline" : r.ratio === null ? "—" : formatVersus(r.ratio),
            r.sinceLastRun === null ? "—" : percent(r.sinceLastRun),
            `${r.fixtures}/${fixtureCount}${r.failed ? ", DNF" : ""}`,
            r.version ?? "—",
          ]),
      ),
      "",
      ...(report.unranked.length === 0
        ? []
        : [
            `Not ranked (completed no fixture): ${report.unranked.map((t) => label(report, t)).join(", ")}.`,
            "",
          ]),
    ],
    "trend-by-tool": [
      `Each tool's mean on this run, and how it moved from its first to its last run in the trend window${trend.focus === null ? "" : ` (focused on ${trend.focus.from} to ${trend.focus.to})`}; lower is faster.`,
      "",
      table(
        ["Tool", "Mean", "Change in window", "From", "To"],
        report.means
          .filter((m) => shown(m.tool))
          .map((m) => {
            const series = trend.inFocus.map((p) => p.byTool[m.tool] ?? null);
            const moved = windowChange(series);
            return [
              label(report, m.tool),
              formatDuration(m.mean),
              moved === null ? "—" : percent(moved.change),
              moved === null ? "—" : (trend.inFocus[moved.from]?.date ?? "—"),
              moved === null ? "—" : (trend.inFocus[moved.to]?.date ?? "—"),
            ];
          }),
      ),
      "",
    ],
    "time-trend": [
      `${metric === "total" ? `Mean ${report.measure} time in seconds` : METRIC_TEXT[metric].unit}, ${grid.rows} from ${filters.window.from} to ${filters.window.to}.${trend.cut === null ? "" : ` ${trend.cut}`} An empty cell is a ${grid.row} with no published value for that tool: no run, a DNF, a partial run or an exclusion. The chart bridges those with a dotted line by default; nothing is interpolated here. For other windows use the history endpoint: ${abs(`/api/v1/${section.id}/${encodeURIComponent(scenario.variation)}/history`)}`,
      "",
      ...trendLines({
        rows: metricRows(
          rowsOf(trend.series),
          [...report.ranked, ...report.unranked],
          metric,
          report.baseline,
        ),
        runs: trend.points,
        markers: trend.markers,
        outliers: trend.outliers,
        tools,
        fixtureCount,
        label: (tool) => label(report, tool),
        level: "####",
      }),
    ],
    "time-bars": [
      `Mean across ${fixtureCount === 1 ? "the fixture" : `all ${fixtureCount} fixtures`}, fastest first; only tools that completed every fixture.`,
      "",
      barTable(report.timeBars.bars, "s", timeReference),
      "",
    ],
    "time-by-fixture": [
      "Each fixture's tools, fastest first. A tool is listed on every fixture it finished; a failed run is named, not timed.",
      "",
      ...fixtureBars(report.timeRows).flatMap((f) => {
        const reference = f.bars.find((b) => b.tool === report.baseline)?.value;
        const failed = f.failed.filter(shown);
        return [
          `#### ${fixtureLabel(f.fixture)}`,
          "",
          barTable(f.bars, "s", reference),
          "",
          ...(failed.length === 0
            ? []
            : [`Did not finish: ${failed.map((t) => label(report, t)).join(", ")}.`, ""]),
        ];
      }),
    ],
    "time-table": [
      "Mean seconds per fixture. DNF: the run exited non-zero and is excluded from every figure. —: not run on that fixture.",
      "",
      perFixture(report, report.timeRows),
      "",
    ],
    "per-package-chart": [
      "Milliseconds per installed package, mean across fixtures, fastest first; only tools with a value on every fixture.",
      "",
      barTable(report.perPackageBars.bars, "ms", ppReference),
      "",
    ],
    "per-package-by-fixture": [
      `Each fixture's per-package time, run by run, ${grid.rows}; an empty cell is no value for that tool on that ${grid.row}.`,
      "",
      ...trend.perPackageByFixture.flatMap(({ fixture, series }) => {
        const rows = rowsOf(series);
        return [
          `#### ${fixtureLabel(fixture)}`,
          "",
          ...trendLines({
            rows,
            runs: trend.points.map((p) => ({
              date: p.date,
              fixtures: p.fixtures.filter((f) => f === fixture),
              failed: Object.fromEntries(
                Object.entries(p.failed).map(([t, l]) => [
                  t,
                  l.filter((e) => e.fixture === fixture),
                ]),
              ),
            })),
            markers: [],
            outliers: tools.flatMap((tool) =>
              flagOutliers(rows.map((r) => (typeof r[tool] === "number" ? r[tool] : null))).flatMap(
                (deviation, i) =>
                  deviation === null ? [] : [{ tool, date: rows[i]?.date ?? "", deviation }],
              ),
            ),
            tools,
            fixtureCount: 1,
            label: (tool) => label(report, tool),
            level: "#####",
          }),
        ];
      }),
    ],
    "per-package-table": [perFixture(report, report.perPackageRows), ""],
    "package-count": [
      "Packages installed. A range after a count means that tool's installs did not all produce the same number.",
      "",
      counts(report, report.packageCounts),
      "",
    ],
    "process-count": [counts(report, report.processCounts), ""],
  };
};

/**
 * What the per-package section says before its figures: that its numbers are
 * derived, and why a tool can be missing. The report's Markdown opens the
 * section with it, and so does the page's twin (an `<AgentOnly>` in page.tsx);
 * on the page it is the figures' guides and axis labels.
 */
export const PER_PACKAGE_DERIVED =
  "Derived: install time divided by the number of packages the tool installed. A tool with a time but no published package count is left out rather than divided by a guess.";

/** What a derived average is the mean of: its scenarios, per fixture where they differ. */
export const meanOf = ({
  scenarios,
  byFixture,
}: NonNullable<ReportModel["scenario"]["averageOf"]>): string =>
  Object.values(byFixture).every((v) => v.length === scenarios.length)
    ? `Mean of: ${scenarios.join(", ")}.`
    : `Mean of, per fixture: ${Object.entries(byFixture)
        .map(([f, v]) => `${fixtureLabel(f)}: ${v.join(", ")}`)
        .join("; ")}.`;

/** The run and the filters a report is for: what the page's menus, picker and chips show. */
export const runMarkdown = (report: ReportModel): string[] => {
  const { section, scenario, run, filters, trend } = report;
  /* What the trend shows: the reader's metric, as the chart and the history
     endpoint apply it. Per package falls back to total where it cannot be drawn. */
  const metric: Metric = filters.metric === "per-package" ? trend.plotted : filters.metric;
  const fixtureCount = report.fixtures.length;
  return [
    `- Run: ${run.date}${run.isLatest ? " (the latest run)" : ` (not the latest run; the latest is ${run.latest})`}. Results regenerate nightly.`,
    `- Measured: mean ${report.measure} time ${filters.fixture === null ? `across ${fixtureCount} ${fixtureCount === 1 ? "fixture" : "fixtures"}` : `on the ${fixtureLabel(filters.fixture)} fixture`}${scenario.averageOf === null ? "" : `, averaged over ${scenario.averageOf.scenarios.length} scenarios (derived, not measured)`}, on GitHub-hosted ubuntu-24.04-arm runners.${section.id === "registries" ? " Every registry is installed from with the same npm client." : ""}`,
    `- Filters in effect:`,
    `  - fixture: ${filters.fixture === null ? `all (${report.fixtures.join(", ")})` : filters.fixture}`,
    `  - trend window: ${filters.window.custom ? "custom" : rangeLabel(filters.range).toLowerCase()}, ${filters.window.from} to ${filters.window.to}`,
    `  - trend metric: ${METRIC_TEXT[metric].name}`,
    `  - hidden tools: ${filters.hide.length === 0 ? "none" : filters.hide.join(", ")}`,
    `  - excluded runs: ${filters.exclude.length === 0 ? "none" : filters.exclude.join(", ")}`,
    "",
  ];
};

/**
 * What a report is read against: its caveats, method, environment, data and
 * citation. The page keeps the raw files in a menu and the method on its own
 * page; the twin says them here.
 */
export const referenceMarkdown = (report: ReportModel, origin: string): string[] => {
  const abs = (path: string) => new URL(path, origin).href;
  const { section, scenario, filters, finding, caveats } = report;
  const query = viewHref(report).slice(report.path.length);
  const notes = [
    ...caveats.leaderboard.map((n) => `${n.title}. ${n.body}`),
    ...caveats.timeBars.map((n) => `Total ${report.measure} time by tool — ${n.title}. ${n.body}`),
    ...caveats.perPackageBars.map((n) => `Per-package time by tool — ${n.title}. ${n.body}`),
    ...(caveats.hidden === null ? [] : [`${caveats.hidden.title}. ${caveats.hidden.body}`]),
  ];
  return [
    "## Caveats",
    "",
    "- Total time is the measurement. Per-package time, change since start and relative-to-baseline are derived from it and labelled derived wherever they appear.",
    ...(finding.qualifier === null ? [] : [`- A faster mean is not ranked. ${finding.qualifier}`]),
    ...notes.map((n) => `- ${n}`),
    ...(filters.exclude.length === 0
      ? []
      : [`- Excluded from every trend by request: ${filters.exclude.join(", ")}.`]),
    ...(caveats.disclosure === null ? [] : [`- Disclosure. ${caveats.disclosure}`]),
    "",
    "## Method",
    "",
    METHOD,
    "",
    "## Environment",
    "",
    ...RUNNER.map(([term, value]) => `- ${term}: \`${value}\``),
    "",
    RUNNER_NOTE,
    "",
    "## Data & source",
    "",
    ...report.raw.map((r) => `- Raw results, ${r.label} (JSON): ${r.href}`),
    `- This report as JSON: ${abs(`/api/v1/${section.id}/${encodeURIComponent(scenario.variation)}${query}`)}`,
    `- API description: ${abs("/openapi.json")}`,
    `- Index of every page: ${abs("/llms.txt")}`,
    ...RESOURCES.map(([term, , href]) => `- ${term}: ${href}`),
    "",
    "## Cite",
    "",
    `- URL: ${abs(report.citation.path)}`,
    `- APA: ${citation("apa", report.citation, abs(report.citation.path))}`,
    "",
    "```bibtex",
    citation("bibtex", report.citation, abs(report.citation.path)),
    "```",
    "",
  ];
};

export const reportMarkdown = (report: ReportModel, origin: string): string => {
  const abs = (path: string) => new URL(path, origin).href;
  const { section, scenario, finding } = report;
  const perPackage = report.outline.some((s) => s.id === "per-package");
  const footprint = report.outline.find((s) => s.id === "footprint");
  const lines: string[] = [];
  const add = (...more: string[]) => lines.push(...more);

  add(
    `# ${section.label} — ${scenario.variation} (${abs(viewHref(report))})`,
    "",
    `Benchmarks / ${section.label} / ${scenario.variation}`,
    "",
    ...runMarkdown(report),
    "## Headline",
    "",
    finding.sentence,
    "",
  );
  if (finding.qualifier !== null) add(`Not ranked: ${finding.qualifier}`, "");
  if (report.stats !== null) {
    add(...report.stats.map((s) => `- ${s.label}: ${s.value} (${s.detail})`), "");
  }

  add("## Scenario", "", scenario.description);
  if (scenario.uncurated) add("", "Published in this run, and not yet in any curated ordering.");
  if (scenario.averageOf !== null) add("", meanOf(scenario.averageOf));
  if (scenario.stateParts !== null) {
    add(
      "",
      `Before each run: ${scenario.stateParts.map((p) => `${p.name} ${p.word}`).join(", ")}.`,
    );
  }
  add("");

  const figures = figureMarkdown(report, origin);
  const body = (figure: string): readonly string[] => figures[figure] ?? [];
  const items = new Set(report.outline.flatMap((s) => s.items.map((i) => i.id)));
  const measureTitle = report.isScript ? "Execution" : "Install";

  add("## Leaderboard", "", ...body("leaderboard-table"));

  /*
   * The rest follows the page, section by section and figure by figure, in
   * its order and under its titles (`outline`): each chart as the numbers it
   * draws, each table as a table.
   */
  add(`## ${measureTitle} time`, "");
  if (items.has("trend-by-tool")) add("### Trend by tool", "", ...body("trend-by-tool"));
  add("### Performance over time", "", ...body("time-trend"));
  add(`### Total ${report.measure} time by tool`, "", ...body("time-bars"));
  if (items.has("time-by-fixture")) {
    add(`### Total ${report.measure} time by fixture`, "", ...body("time-by-fixture"));
  }
  add(`### Total ${report.measure} time data`, "", ...body("time-table"));
  if (perPackage) {
    add(
      "## Per-package install time",
      "",
      PER_PACKAGE_DERIVED,
      "",
      "### Per-package time by tool",
      "",
      ...body("per-package-chart"),
    );
    if (items.has("per-package-by-fixture")) {
      add(
        "### Per-package time by fixture (ms per installed package, derived)",
        "",
        ...body("per-package-by-fixture"),
      );
    }
    add("### Per-package time data", "", ...body("per-package-table"));
  }
  if (footprint !== undefined) {
    add("## Install footprint", "");
    if (footprint.items.some((i) => i.id === "package-count")) {
      add("### Package count", "", ...body("package-count"));
    }
    if (footprint.items.some((i) => i.id === "process-count")) {
      add("### Spawned processes", "", ...body("process-count"));
    }
  }

  add(...referenceMarkdown(report, origin));
  return lines.join("\n");
};

/** A scenario's history (`historyOf`) as Markdown: what was asked, then the trend. */
export const historyMarkdown = (history: History, origin: string): string => {
  const section = history.section as SectionId;
  const grid = layout(perDay(history.rows));
  const label = (tool: string) => toolLabel(tool, section);
  return [
    `# ${SECTION_DEFS[section].label} — ${history.scenario}: history`,
    "",
    `- Run: ${history.run}. Results regenerate nightly.`,
    `- Window: ${history.window.from} to ${history.window.to}${history.window.custom ? "" : " (a preset window ending at the run)"}`,
    `- Fixture: ${history.fixture ?? `all (${history.fixtures.join(", ")})`}`,
    `- Values: ${history.unit}${history.derived ? " (derived from total time)" : ""}`,
    `- Tools: ${history.tools.map((t) => (label(t) === t ? t : `${label(t)} (${t})`)).join(", ")}`,
    `- Excluded runs: ${history.excluded.length === 0 ? "none" : history.excluded.join(", ")}`,
    "",
    `${sentence(grid.rows)}. An empty cell is a ${grid.row} with no comparable value for that tool: no run, a DNF, a partial run or an exclusion. Nothing is interpolated.`,
    "",
    ...trendLines({
      rows: history.rows,
      runs: history.runs,
      markers: history.markers,
      outliers: history.outliers,
      tools: history.tools,
      fixtureCount: history.fixtures.length,
      label,
    }),
    `As JSON: ${new URL(`/api/v1/${section}/${encodeURIComponent(history.scenario)}/history`, origin).href}`,
    "",
  ].join("\n");
};
