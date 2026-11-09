import { createLlmsTxtHandler } from "@affordances/md/next";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { TWIN_CACHE } from "@/lib/markdown";
import { READING, SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/metadata";
import { DESCRIPTIONS, scenarioPath, withAverage } from "@/lib/scenarios";
import { SECTION_DEFS, SECTIONS } from "@/lib/sections";

/**
 * The llms.txt index, in the docs' shape: a title, a summary, how to read the
 * results, then every page. Its links are objects, so no page is rendered to
 * name it; built per request for the site's origin in the note.
 */
export const GET = (request: Request) => {
  const abs = (path: string) => new URL(path, siteOrigin(request)).href;
  return createLlmsTxtHandler({
    title: SITE_NAME,
    summary: SITE_DESCRIPTION,
    note: `Every page is available as Markdown: append \`.md\` to its URL, or request the page with an \`Accept: text/markdown\` header. The links below point at the Markdown versions. Query parameters apply to the Markdown as they do to the page: ${abs("/package-managers/clean.md?fixture=babylon")} is that scenario on one fixture. [llms-full.txt](${abs("/llms-full.txt")}) holds every scenario of the latest run, at the default view, in one file. [Methodology](${abs("/methodology.md")}) holds the method, the runner environment and what each scenario measures. [About](${abs("/about.md")}) is this index as a page; \`/\` itself opens on the registries average, and each benchmark's own URL on its average: the derived mean of its scenarios.`,
    full: false,
    publicCache: TWIN_CACHE,
    sections: async () => {
      const { scenarios } = await loadCatalog(dataClient());
      return [
        {
          title: "Reading the results",
          intro: [
            ...READING.map((line) => `- ${line}`),
            "- Page parameters: `date`, `fixture`, `range` (today, 1w, 1m, 1y or all: rolling days of trend ending at the run; default 1m), `from` and `to` (an exact trend window), `hide` (comma-separated tools), `metric` (total, change, baseline or per-package), `exclude` (`YYYY-MM-DD` or `tool@YYYY-MM-DD`, comma-separated).",
          ].join("\n"),
        },
        {
          title: "API and MCP",
          intro: [
            `- JSON API, described at [openapi.json](${abs("/openapi.json")}): \`/api/v1/runs\`, \`/api/v1/catalog\`, \`/api/v1/{section}/{scenario}\` (the full report, same parameters as the page) and \`/api/v1/{section}/{scenario}/history\` (the trend, failures and coverage).`,
            `- MCP server (streamable HTTP, read-only, no auth): ${abs("/mcp")}. Tools: \`list_benchmarks\`, \`get_results\`, \`get_history\`, \`compare_scenarios\`. Add it to Claude Code with \`claude mcp add --transport http vlt-benchmarks ${abs("/mcp")}\`.`,
          ].join("\n"),
        },
        {
          title: "Benchmarks",
          sections: SECTIONS.map((section) => ({
            title: SECTION_DEFS[section].label,
            intro: SECTION_DEFS[section].about,
            pages: withAverage(scenarios[section]).map((s) => ({
              url: abs(scenarioPath(section, s.variation)),
              title: s.variation,
              description: DESCRIPTIONS[s.variation] ?? "Published, with no description yet.",
            })),
          })),
        },
      ];
    },
  })(request);
};
