/**
 * The MCP server's tools, as plain functions over the report model so they
 * can be tested without a transport. Each answers with the Markdown agents
 * read best, and the same data as `structuredContent`. Read-only: every
 * number here is already public.
 */
import type { DataClient } from "@benchmarks/data";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { historyOf, strictReport, unknownTools, type ApiError } from "./api";
import { describeCatalog } from "./catalog";
import { dataClient } from "./data";
import { METRICS } from "./figures";
import { historyMarkdown, reportMarkdown } from "./markdown";
import { loadReportParams } from "./params";
import { loadReport } from "./report";
import { AVERAGE, DESCRIPTIONS } from "./scenarios";
import { SECTION_DEFS, SECTIONS } from "./sections";
import { fixtureLabel, toolLabel } from "./tools";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date, YYYY-MM-DD.");
const section = z.enum(SECTIONS).describe("The benchmark.");
const scenario = z
  .string()
  .min(1)
  .describe(
    "A scenario of the benchmark, e.g. clean or cache+lockfile, or average: the derived mean of them. list_benchmarks lists them.",
  );
const fixture = z.string().min(1).describe("One fixture; omitted means all of them.");
const tools = z.array(z.string().min(1)).describe("Tool keys, e.g. bun, npm; omitted means all.");

export const inputs = {
  list_benchmarks: z.object({}),
  get_results: z.object({
    section,
    scenario,
    date: date.optional().describe("A published run; omitted means the latest."),
    fixture: fixture.optional(),
    hide: tools.optional().describe("Tools left out of the tables; rankings still count them."),
    metric: z.enum(METRICS).optional().describe("What the trend holds. Only total is measured."),
  }),
  get_history: z.object({
    section,
    scenario,
    tools: tools.optional(),
    from: date.optional().describe("Window start, a published date; with to. At most 120 days."),
    to: date
      .optional()
      .describe("Window end, a published date. Omitted: the 30 days to the latest run."),
    fixture: fixture.optional(),
    metric: z.enum(METRICS).optional(),
    exclude: z
      .array(z.string().regex(/^([^@]+@)?\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD or tool@YYYY-MM-DD."))
      .optional()
      .describe("Runs taken out of the trend."),
  }),
  compare_scenarios: z.object({
    section,
    tools: tools.optional(),
    date: date.optional().describe("A published run; omitted means the latest."),
    fixture: fixture.optional(),
  }),
};

type Input<K extends keyof typeof inputs> = z.infer<(typeof inputs)[K]>;

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent: { [key: string]: unknown };
  isError?: boolean;
}

const ok = (text: string, structured: object): ToolResult => ({
  content: [{ type: "text", text }],
  structuredContent: structured as { [key: string]: unknown },
});

const failure = (error: ApiError): ToolResult => ({
  content: [{ type: "text", text: `Error (${error.code}): ${error.message} ${error.hint}` }],
  structuredContent: { error: { code: error.code, message: error.message, hint: error.hint } },
  isError: true,
});

const list = (values: readonly string[] | undefined) => values?.join(",");

export const listBenchmarks = async (client: DataClient = dataClient()): Promise<ToolResult> => {
  const [{ dates }, catalog] = await Promise.all([client.getIndex(), describeCatalog(client)]);
  const text = [
    "# vlt benchmarks",
    "",
    `Latest run: ${catalog.latest ?? "none"}. Published runs: ${dates.length}, from ${dates[0] ?? "—"} to ${dates.at(-1) ?? "—"}; results regenerate nightly.`,
    "",
    ...catalog.sections.flatMap((s) => [
      `## ${s.label} (\`${s.id}\`)`,
      "",
      s.about,
      "",
      `Tools: ${s.tools.map((t) => (t.label === t.key ? t.key : `${t.label} (\`${t.key}\`)`)).join(", ")}.`,
      `Fixtures: ${s.fixtures.map((f) => `${f.label} (\`${f.key}\`)`).join(", ")}.`,
      "",
      ...(s.scenarios.filter((c) => !c.uncurated).length < 2
        ? []
        : [`- \`${AVERAGE}\`: ${DESCRIPTIONS[AVERAGE]}`]),
      ...s.scenarios.map(
        (c) => `- \`${c.variation}\`: ${c.description ?? "Published, with no description yet."}`,
      ),
      "",
    ]),
  ].join("\n");
  return ok(text, { runs: { latest: catalog.latest, dates }, catalog });
};

export const getResults = async (
  args: Input<"get_results">,
  origin: string,
  client: DataClient = dataClient(),
): Promise<ToolResult> => {
  const query = loadReportParams({
    date: args.date,
    fixture: args.fixture,
    hide: list(args.hide),
    metric: args.metric,
  });
  const result = await strictReport({ ...args, query, client });
  return "error" in result
    ? failure(result.error)
    : ok(reportMarkdown(result.report, origin), result.report);
};

export const getHistory = async (
  args: Input<"get_history">,
  origin: string,
  client: DataClient = dataClient(),
): Promise<ToolResult> => {
  const query = loadReportParams({
    fixture: args.fixture,
    from: args.from,
    to: args.to,
    metric: args.metric,
    exclude: list(args.exclude),
  });
  const result = await strictReport({ ...args, query, client });
  if ("error" in result) return failure(result.error);
  const unknown = unknownTools(result.report, args.tools ?? []);
  if (unknown !== null) return failure(unknown);
  const history = historyOf(result.report, args.tools);
  return ok(historyMarkdown(history, origin), history);
};

interface ComparedScenario {
  readonly variation: string;
  readonly error?: string;
  readonly finding?: string;
  readonly fixtures?: number;
  readonly means?: readonly {
    readonly tool: string;
    /** `null` for a tool that completed no fixture. */
    readonly rank: number | null;
    readonly mean: number | null;
    readonly rsd: number | null;
    readonly fixtures: number;
    readonly failed: boolean;
  }[];
}

/** Each scenario's means for the given tools on one run, by looping the report. */
export const compareScenarios = async (
  args: Input<"compare_scenarios">,
  client: DataClient = dataClient(),
): Promise<ToolResult> => {
  const { dates, latest } = await client.getIndex();
  if (args.date !== undefined && !dates.includes(args.date)) {
    return failure({
      status: 400,
      code: "unknown_selection",
      message: `No run was published on ${args.date}.`,
      hint: "list_benchmarks lists the published dates.",
    });
  }
  const query = loadReportParams({ date: args.date, fixture: args.fixture });
  const listing = await loadReport({ section: args.section, query, client });
  if (listing.status !== "unknown-scenario") {
    // No scenarios at all: the strict report says why (no dates, or no results that run).
    const result = await strictReport({ section: args.section, scenario: "", query, client });
    if ("error" in result) return failure(result.error);
  }
  const variations = listing.status === "unknown-scenario" ? listing.scenarios : [];
  const reports = await Promise.all(
    variations.map(async (variation) => ({
      variation,
      result: await strictReport({ section: args.section, scenario: variation, query, client }),
    })),
  );
  const measured = reports.flatMap(({ result }) =>
    "report" in result ? [...result.report.ranked, ...result.report.unranked] : [],
  );
  const chosen = [...new Set(measured)].filter(
    (t) => args.tools === undefined || args.tools.length === 0 || args.tools.includes(t),
  );
  const unknown = (args.tools ?? []).filter((t) => !measured.includes(t));
  if (unknown.length > 0) {
    return failure({
      status: 400,
      code: "unknown_tool",
      message: `No ${args.section} scenario has results for ${unknown.join(", ")}.`,
      hint: `Tools: ${[...new Set(measured)].join(", ")}.`,
    });
  }

  const scenarios = reports.map(({ variation, result }): ComparedScenario =>
    "error" in result
      ? { variation, error: result.error.message }
      : {
          variation,
          finding: result.report.finding.sentence,
          fixtures: result.report.fixtures.length,
          means: chosen.flatMap((tool): NonNullable<ComparedScenario["means"]> => {
            const row = result.report.leaderboard.find((r) => r.tool === tool);
            if (row !== undefined) {
              const { rank, mean, rsd, fixtures, failed } = row;
              return [{ tool, rank, mean, rsd, fixtures, failed }];
            }
            return result.report.unranked.includes(tool)
              ? [{ tool, rank: null, mean: null, rsd: null, fixtures: 0, failed: true }]
              : [];
          }),
        },
  );
  const run = args.date ?? latest;
  const label = (tool: string) => toolLabel(tool, args.section);
  const cell = (s: ComparedScenario, tool: string) => {
    if (s.means === undefined || s.fixtures === undefined) return "—";
    const m = s.means.find((x) => x.tool === tool);
    if (m === undefined) return "—";
    if (m.mean === null) return "DNF";
    return `${Number(m.mean.toFixed(3))}${m.fixtures < s.fixtures ? ` (${m.fixtures}/${s.fixtures})` : ""}`;
  };
  const text = [
    `# ${SECTION_DEFS[args.section].label}: scenarios compared`,
    "",
    `- Run: ${run}. Results regenerate nightly.`,
    `- Fixture: ${args.fixture === undefined ? "all" : fixtureLabel(args.fixture)}`,
    "",
    "Mean seconds per scenario; lower is faster. n/N: the tool completed n of N fixtures, so that mean is not comparable with complete ones and it is not ranked. DNF: it completed none. —: not measured.",
    "",
    `| Tool | ${scenarios.map((s) => s.variation).join(" | ")} |`,
    `| --- | ${scenarios.map(() => "---").join(" | ")} |`,
    ...chosen.map(
      (tool) => `| ${label(tool)} | ${scenarios.map((s) => cell(s, tool)).join(" | ")} |`,
    ),
    "",
    "## Headlines",
    "",
    ...scenarios.map((s) => `- \`${s.variation}\`: ${s.finding ?? s.error}`),
    "",
  ].join("\n");
  return ok(text, {
    section: args.section,
    run,
    fixture: args.fixture ?? null,
    tools: chosen,
    scenarios,
  });
};

export const registerTools = (server: McpServer, origin: string) => {
  const readOnly = { readOnlyHint: true, openWorldHint: false };
  server.registerTool(
    "list_benchmarks",
    {
      title: "List benchmarks",
      description:
        "The benchmarks (registries, package managers, task runners), their scenarios, tools and fixtures in the latest run, and every published run date.",
      inputSchema: inputs.list_benchmarks,
      annotations: readOnly,
    },
    () => listBenchmarks(),
  );
  server.registerTool(
    "get_results",
    {
      title: "Get results",
      description:
        "One scenario's full report for one run: the headline, leaderboard, per-fixture times, per-package times, footprint, the trend as CSV, caveats and sources. Total time is the measurement; derived figures say so.",
      inputSchema: inputs.get_results,
      annotations: readOnly,
    },
    (args) => getResults(args, origin),
  );
  server.registerTool(
    "get_history",
    {
      title: "Get history",
      description:
        "One scenario's trend over a window of runs: one row per calendar day per tool, with DNFs, coverage, version changes and flagged outliers.",
      inputSchema: inputs.get_history,
      annotations: readOnly,
    },
    (args) => getHistory(args, origin),
  );
  server.registerTool(
    "compare_scenarios",
    {
      title: "Compare scenarios",
      description:
        "Every scenario of one benchmark side by side for one run: each tool's mean in each scenario, and each scenario's headline.",
      inputSchema: inputs.compare_scenarios,
      annotations: readOnly,
    },
    (args) => compareScenarios(args),
  );
};
