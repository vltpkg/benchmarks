/**
 * The report for readers that must not be second-guessed: the JSON API and
 * the MCP tools. The page falls back quietly from a stale link; these refuse
 * it, and say what would have worked.
 */
import type { DataClient } from "@benchmarks/data";
import { dataClient } from "./data";
import { metricRows } from "./figures";
import { MAX_WINDOW_DAYS } from "./params";
import { ignoredSelection, loadReport, type ReportModel, type ReportQuery } from "./report";
import { SECTIONS } from "./sections";

export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly hint: string;
}

export const errorResponse = ({ status, code, message, hint }: ApiError): Response =>
  Response.json({ error: { code, message, hint } }, { status });

export const strictReport = async ({
  section,
  scenario,
  query,
  client = dataClient(),
}: {
  section: string;
  scenario: string;
  query: ReportQuery;
  client?: DataClient;
}): Promise<{ report: ReportModel } | { error: ApiError }> => {
  const result = await loadReport({ section, scenario, query, client });
  switch (result.status) {
    case "unknown-section":
      return {
        error: {
          status: 404,
          code: "unknown_section",
          message: `No benchmark named "${section}".`,
          hint: `Benchmarks: ${SECTIONS.join(", ")}. /api/v1/catalog lists them with their scenarios.`,
        },
      };
    case "no-dates":
      return {
        error: {
          status: 503,
          code: "no_data",
          message: "The served tree reports no dates.",
          hint: "There is nothing to show until a run is published.",
        },
      };
    case "no-results":
      return {
        error: {
          status: 404,
          code: "no_results",
          message: `The run of ${result.date} published no ${section} results.`,
          hint:
            result.availableDates.length === 0
              ? "/api/v1/runs lists the published dates."
              : `Recent runs that did: ${result.availableDates.join(", ")}.`,
        },
      };
    case "unknown-scenario":
      return {
        error: {
          status: 404,
          code: "unknown_scenario",
          message: `No scenario "${scenario}" in ${section}${query.date === null ? "" : ` on ${query.date}`}.`,
          hint: `Scenarios: ${result.scenarios.join(", ")}.`,
        },
      };
    case "ok": {
      const ignored = ignoredSelection(query, result.report);
      if (ignored !== null) {
        return {
          error: {
            status: 400,
            code: "unknown_selection",
            message: ignored,
            hint: "/api/v1/runs lists the published dates; /api/v1/catalog the fixtures.",
          },
        };
      }
      const { window } = result.report.filters;
      if ((query.from !== null || query.to !== null) && !window.custom) {
        return {
          error: {
            status: 400,
            code: "invalid_window",
            message: `The window ${query.from ?? "?"} to ${query.to ?? "?"} cannot be used.`,
            hint: `from and to must both be published dates, from no later than to, to no later than the run shown, and less than ${MAX_WINDOW_DAYS} days apart. /api/v1/runs lists the published dates.`,
          },
        };
      }
      return { report: result.report };
    }
  }
};

/** The trend, failures and coverage of a report, narrowed to some tools. */
export const historyOf = (report: ReportModel, tools?: readonly string[]) => {
  const all = [...report.ranked, ...report.unranked];
  const chosen =
    tools === undefined || tools.length === 0 ? all : all.filter((t) => tools.includes(t));
  const pick = <T>(byTool: { readonly [tool: string]: T }) =>
    Object.fromEntries(Object.entries(byTool).filter(([tool]) => chosen.includes(tool)));
  const { metric } = report.filters;
  const plotted = metric === "per-package" ? report.trend.plotted : metric;
  return {
    section: report.section.id,
    scenario: report.scenario.variation,
    run: report.run.date,
    fixture: report.filters.fixture,
    fixtures: report.fixtures,
    metric: plotted,
    derived: plotted !== "total",
    unit: {
      total: "seconds",
      "per-package": "milliseconds per installed package",
      change: "percent since the tool's first run in the window",
      baseline: "multiple of the baseline's time on the same run",
    }[plotted],
    baseline: report.baseline,
    window: report.filters.window,
    excluded: report.filters.exclude,
    tools: chosen,
    /* One row per calendar day; `null` is a day with no value, never a zero. */
    rows: metricRows(report.trend.rows, all, plotted, report.baseline).map((row) => ({
      date: row.date,
      ...pick(row),
    })),
    /* Each published run: fixtures, partial means, failures, spread, per-fixture seconds. */
    runs: report.trend.points.map((p) => ({
      date: p.date,
      fixtures: p.fixtures,
      partial: pick(p.partial),
      failed: pick(p.failed),
      rsd: pick(p.rsd),
      byFixture: pick(p.byFixture),
    })),
    markers: report.trend.markers.filter((m) => chosen.includes(m.tool)),
    outliers: report.trend.outliers.filter((o) => chosen.includes(o.tool)),
  };
};

export type History = ReturnType<typeof historyOf>;

export const unknownTools = (report: ReportModel, tools: readonly string[]): ApiError | null => {
  const all = [...report.ranked, ...report.unranked];
  const unknown = tools.filter((t) => !all.includes(t));
  return unknown.length === 0
    ? null
    : {
        status: 400,
        code: "unknown_tool",
        message: `No results for ${unknown.join(", ")} in ${report.section.id}/${report.scenario.variation} on ${report.run.date}.`,
        hint: `Tools: ${all.join(", ")}.`,
      };
};
