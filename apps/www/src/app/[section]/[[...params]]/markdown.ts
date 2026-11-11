import type { MarkdownArgs, Slots } from "@affordances/md/next";
import {
  figureMarkdown,
  meanOf,
  referenceMarkdown,
  runMarkdown,
  TWIN_CACHE,
  type FigureMarkdown,
} from "@/lib/markdown";
import { siteOrigin } from "@/lib/metadata";
import { loadReportParams } from "@/lib/params";
import { ignoredSelection, loadReport, type ReportResult } from "@/lib/report";
import { SECTION_DEFS } from "@/lib/sections";

/**
 * The report's Markdown twin (@affordances/md): the page's own HTML,
 * converted, with each figure's `<AgentSlot>` (components/report.tsx `Figure`)
 * filled with the numbers it draws -- the same builders as the MCP tools' and
 * the API's Markdown (lib/markdown.ts). A chart is canvas, and a table on the
 * page is formatted for reading; a twin carries the values.
 *
 * A 404 an agent can act on: an unknown section is the page's own
 * `notFound()`, and `notFoundMarkdown` gives it our body. The page answers the
 * other two with something other than a 404 (a redirect to the section's own
 * report, the scenario with the extra segment ignored), so the default export
 * answers those itself.
 */
type Route = "/[section]/[[...params]]";
type Args = MarkdownArgs<Route>;

const decode = (segment: string | undefined) =>
  segment === undefined ? undefined : decodeURIComponent(segment);

/* One report a twin request, however many of its slots fill. */
const loaded = new WeakMap<Request, Promise<{ result: ReportResult; figures?: FigureMarkdown }>>();
const report = (args: Args) => {
  let found = loaded.get(args.request);
  if (found === undefined) {
    const query = loadReportParams(args.searchParams);
    found = loadReport({
      section: decode(args.params.section) ?? "",
      scenario: decode(args.params.params?.[0]),
      query,
    }).then((result) => ({
      result,
      ...(result.status === "ok"
        ? { figures: figureMarkdown(result.report, siteOrigin(args.request)) }
        : {}),
    }));
    loaded.set(args.request, found);
  }
  return found;
};

const pathOf = (args: Args) => {
  const segments = [args.params.section, ...(args.params.params ?? [])].map((s) => decode(s) ?? "");
  return { segments, path: `/${segments.map(encodeURIComponent).join("/")}` };
};

const notFoundBody = (args: Args, path: string, detail = "") => {
  const abs = (to: string) => new URL(to, siteOrigin(args.request)).href;
  return `# 404: Page not found\n\nThere is no page at \`${path}\` on vlt benchmarks.${detail}\n\n- [llms.txt](${abs("/llms.txt")}) lists every page, each available as Markdown\n- [openapi.json](${abs("/openapi.json")}) describes the JSON API\n- [Home](${abs("/")})\n`;
};

const notFound = (args: Args, path: string, detail?: string) =>
  new Response(notFoundBody(args, path, detail), {
    status: 404,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });

/* The page's own 404: an unknown section. */
export const notFoundMarkdown = (args: Args) => notFoundBody(args, pathOf(args).path);

export const publicCache = TWIN_CACHE;

export default async function markdown(args: Args) {
  const { segments, path } = pathOf(args);
  /* The page renders `/{section}/{scenario}/extra` as the scenario, with a 200. */
  if (segments.length > 2) return notFound(args, path);
  const { result } = await report(args);
  /* The page redirects an unknown scenario to the section's report, a 307 and no 404. */
  if (result.status === "unknown-scenario" && args.params.params !== undefined) {
    return notFound(
      args,
      path,
      ` Scenarios ${SECTION_DEFS[result.section].label} published in this run: ${result.scenarios.map((s) => `\`${s}\``).join(", ")}.`,
    );
  }
  return undefined;
}

const figure =
  (id: string) =>
  async (args: Args): Promise<string | undefined> => {
    const { figures } = await report(args);
    const lines = figures?.[id];
    return lines === undefined ? undefined : lines.join("\n");
  };

export const slots = {
  /*
   * The run and filters, as the menus and chips show them, and before them a
   * selection the report fell back from: what a strict reader is told and the
   * page leaves silent.
   */
  context: async (args) => {
    const { result } = await report(args);
    if (result.status !== "ok") return undefined;
    const { averageOf } = result.report.scenario;
    const ignored = ignoredSelection(loadReportParams(args.searchParams), result.report);
    return [
      ...(ignored === null ? [] : [`> ${ignored} This is the report without that selection.`, ""]),
      ...(averageOf === null ? [] : [meanOf(averageOf), ""]),
      ...runMarkdown(result.report),
    ].join("\n");
  },
  reference: async (args) => {
    const { result } = await report(args);
    return result.status === "ok"
      ? referenceMarkdown(result.report, siteOrigin(args.request)).join("\n")
      : undefined;
  },
  "leaderboard-table": figure("leaderboard-table"),
  "trend-by-tool": figure("trend-by-tool"),
  "time-trend": figure("time-trend"),
  "time-bars": figure("time-bars"),
  "time-by-fixture": figure("time-by-fixture"),
  "time-table": figure("time-table"),
  "per-package-chart": figure("per-package-chart"),
  "per-package-by-fixture": figure("per-package-by-fixture"),
  "per-package-table": figure("per-package-table"),
  "package-count": figure("package-count"),
  "process-count": figure("process-count"),
} satisfies Slots<Route>;
