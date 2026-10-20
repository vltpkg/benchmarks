import { RANGES } from "@/lib/params";
import { METRICS } from "@/lib/figures";
import { SITE_DESCRIPTION, siteOrigin } from "@/lib/metadata";
import { SECTIONS } from "@/lib/sections";

const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const error = (description: string) => json(ref("Error"), description);
const query = (name: string, schema: object, description: string) => ({
  name,
  in: "query",
  required: false,
  schema,
  description,
});
const path = (name: string, schema: object, description: string) => ({
  name,
  in: "path",
  required: true,
  schema,
  description,
});

const scenarioParams = [
  path("section", { type: "string", enum: SECTIONS }, "The benchmark."),
  path(
    "scenario",
    { type: "string" },
    "A scenario published by the run, e.g. `clean` or `cache+lockfile`. /api/v1/catalog lists them.",
  ),
];
const viewParams = [
  query("date", date, "A published run; absent means the latest. An unpublished date is a 400."),
  query(
    "fixture",
    { type: "string" },
    "One fixture; absent means all of them. One the scenario did not publish is a 400.",
  ),
  query(
    "range",
    { type: "integer", enum: RANGES, default: 30 },
    "Trend window: this many calendar days ending at the run.",
  ),
  query(
    "from",
    date,
    "Exact trend window start; with `to`. Both must be published dates, less than 120 days apart.",
  ),
  query("to", date, "Exact trend window end; no later than the run."),
  query(
    "metric",
    { type: "string", enum: METRICS, default: "total" },
    "What the trend holds. Total time is the measurement; the others are derived.",
  ),
  query(
    "exclude",
    { type: "string" },
    "Runs taken out of every trend, comma-separated: `YYYY-MM-DD` or `tool@YYYY-MM-DD`.",
  ),
];

/** A hand-written OpenAPI 3.1 description of the JSON API and the Markdown twins. */
export const GET = (request: Request) =>
  Response.json({
    openapi: "3.1.0",
    info: {
      title: "vlt benchmarks API",
      version: "1.0.0",
      description: `${SITE_DESCRIPTION} Read-only, no authentication. Errors are \`{ error: { code, message, hint } }\`. An MCP server with the same data is at /mcp; every page is indexed as Markdown at /llms.txt.`,
    },
    servers: [{ url: siteOrigin(request) }],
    security: [],
    paths: {
      "/api/v1/runs": {
        get: {
          operationId: "listRuns",
          summary: "Every published run, by date",
          responses: {
            "200": json(ref("Runs"), "The latest run and every published date, oldest first."),
          },
        },
      },
      "/api/v1/catalog": {
        get: {
          operationId: "getCatalog",
          summary: "Benchmarks, their scenarios, tools and fixtures in the latest run",
          responses: { "200": json(ref("Catalog"), "The catalog of the latest run.") },
        },
      },
      "/api/v1/{section}/{scenario}": {
        get: {
          operationId: "getReport",
          summary: "One scenario's full report, as its page shows it",
          parameters: [
            ...scenarioParams,
            ...viewParams,
            query(
              "hide",
              { type: "string" },
              "Tools left out of the rows, comma-separated. Rankings and ratios still count them.",
            ),
          ],
          responses: {
            "200": json(ref("Report"), "The report."),
            "400": error("A date, fixture or window that cannot be used."),
            "404": error(
              "An unknown benchmark or scenario, or a run that published no results for it.",
            ),
          },
        },
      },
      "/api/v1/{section}/{scenario}/history": {
        get: {
          operationId: "getHistory",
          summary: "One scenario's trend, failures and coverage",
          parameters: [
            ...scenarioParams,
            ...viewParams,
            query(
              "tools",
              { type: "string" },
              "Tools to include, comma-separated; absent means all.",
            ),
          ],
          responses: {
            "200": json(ref("History"), "The trend."),
            "400": error("A date, fixture, window or tool that cannot be used."),
            "404": error("An unknown benchmark or scenario."),
          },
        },
      },
      "/{section}/{scenario}.md": {
        get: {
          operationId: "getReportMarkdown",
          summary: "One scenario's report as Markdown",
          description:
            "The same page also answers `Accept: text/markdown` at its own URL. Takes the page's query parameters.",
          parameters: [...scenarioParams, ...viewParams],
          responses: {
            "200": {
              description: "The report.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
            "404": {
              description: "No such page.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "hint"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                hint: { type: "string" },
              },
            },
          },
        },
        Runs: {
          type: "object",
          required: ["latest", "dates"],
          properties: {
            latest: { ...date, type: ["string", "null"] },
            dates: { type: "array", items: date },
          },
        },
        Catalog: {
          type: "object",
          required: ["latest", "sections"],
          properties: {
            latest: { ...date, type: ["string", "null"] },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", enum: SECTIONS },
                  label: { type: "string" },
                  about: { type: "string" },
                  tools: { type: "array", items: ref("Named") },
                  fixtures: { type: "array", items: ref("Named") },
                  scenarios: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        variation: { type: "string" },
                        path: { type: "string" },
                        description: { type: ["string", "null"] },
                        kind: { type: "string", enum: ["cold", "partial", "warm", "ci", "other"] },
                        state: {
                          type: ["object", "null"],
                          properties: {
                            cache: { type: "boolean" },
                            lockfile: { type: "boolean" },
                            nodeModules: { type: "boolean" },
                          },
                        },
                        uncurated: { type: "boolean" },
                        fixtures: { type: "array", items: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        Named: {
          type: "object",
          properties: { key: { type: "string" }, label: { type: "string" } },
        },
        Report: {
          type: "object",
          description:
            "The report model the page is drawn from. Times are seconds (per-package figures milliseconds per installed package). `finding.sentence` is the headline; `leaderboard` the ranking (mean, rsd, ratio to the baseline, sinceLastRun, fixtures, failed, version); `timeRows`/`perPackageRows` the per-fixture values with DNFs in `failed`; `trend.rows` one row per calendar day with `null` for gaps; `caveats` every note the page prints; `raw` the result files.",
          required: [
            "section",
            "scenario",
            "run",
            "filters",
            "finding",
            "leaderboard",
            "trend",
            "caveats",
            "raw",
          ],
          properties: {
            section: { type: "object" },
            scenario: { type: "object" },
            run: {
              type: "object",
              properties: {
                date,
                latest: date,
                isLatest: { type: "boolean" },
                dates: { type: "array", items: date },
              },
            },
            filters: { type: "object" },
            finding: {
              type: "object",
              properties: { sentence: { type: "string" }, qualifier: { type: ["string", "null"] } },
            },
            stats: { type: ["array", "null"] },
            leaderboard: { type: "array", items: { type: "object" } },
            timeRows: { type: "array" },
            perPackageRows: { type: "array" },
            packageCounts: { type: "array" },
            processCounts: { type: "array" },
            trend: { type: "object" },
            caveats: { type: "object" },
            raw: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fixture: { type: "string" },
                  label: { type: "string" },
                  href: { type: "string" },
                },
              },
            },
            citation: { type: "object" },
          },
        },
        History: {
          type: "object",
          required: ["section", "scenario", "run", "metric", "unit", "tools", "rows", "runs"],
          properties: {
            section: { type: "string" },
            scenario: { type: "string" },
            run: date,
            fixture: { type: ["string", "null"] },
            fixtures: { type: "array", items: { type: "string" } },
            metric: { type: "string", enum: METRICS },
            derived: { type: "boolean" },
            unit: { type: "string" },
            baseline: { type: ["string", "null"] },
            window: {
              type: "object",
              properties: { from: date, to: date, custom: { type: "boolean" } },
            },
            excluded: { type: "array", items: { type: "string" } },
            tools: { type: "array", items: { type: "string" } },
            rows: {
              type: "array",
              description:
                "One per calendar day. A tool's value is `null` when nothing comparable was published that day.",
              items: {
                type: "object",
                properties: { date },
                additionalProperties: { type: ["number", "null"] },
              },
            },
            runs: {
              type: "array",
              description:
                "Each published run: its fixtures, partial means, failures, spread and per-fixture seconds.",
              items: { type: "object" },
            },
            markers: { type: "array", items: { type: "object" } },
            outliers: { type: "array", items: { type: "object" } },
          },
        },
      },
    },
  });
