import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { READING, SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/metadata";
import { DESCRIPTIONS, scenarioPath, withAverage } from "@/lib/scenarios";
import { SECTION_DEFS, SECTIONS } from "@/lib/sections";

/** The llms.txt index, in the docs' shape: a title, a summary, how to read the results, then every page. */
export const GET = async (request: Request) => {
  const abs = (path: string) => new URL(path, siteOrigin(request)).href;
  const { scenarios } = await loadCatalog(dataClient());
  const text = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Every page is available as Markdown: append \`.md\` to its URL, or request the page with an \`Accept: text/markdown\` header. The links below point at the Markdown versions. Query parameters apply to the Markdown as they do to the page: ${abs("/package-managers/clean.md?fixture=babylon")} is that scenario on one fixture. [llms-full.txt](${abs("/llms-full.txt")}) holds every scenario of the latest run, at the default view, in one file. [Methodology](${abs("/methodology.md")}) holds the method, the runner environment and what each scenario measures. [About](${abs("/about.md")}) is this index as a page; \`/\` itself opens on the registries average, and each benchmark's own URL on its average: the derived mean of its scenarios.

## Reading the results

${READING.map((line) => `- ${line}`).join("\n")}
- Page parameters: \`date\`, \`fixture\`, \`range\` (30, 60, 90 or 120 days of trend), \`from\` and \`to\` (an exact trend window), \`hide\` (comma-separated tools), \`metric\` (total, change, baseline or per-package), \`exclude\` (\`YYYY-MM-DD\` or \`tool@YYYY-MM-DD\`, comma-separated).

## API and MCP

- JSON API, described at [openapi.json](${abs("/openapi.json")}): \`/api/v1/runs\`, \`/api/v1/catalog\`, \`/api/v1/{section}/{scenario}\` (the full report, same parameters as the page) and \`/api/v1/{section}/{scenario}/history\` (the trend, failures and coverage).
- MCP server (streamable HTTP, read-only, no auth): ${abs("/mcp")}. Tools: \`list_benchmarks\`, \`get_results\`, \`get_history\`, \`compare_scenarios\`. Add it to Claude Code with \`claude mcp add --transport http vlt-benchmarks ${abs("/mcp")}\`.

## Benchmarks
${SECTIONS.map(
  (section) => `
### ${SECTION_DEFS[section].label}

${SECTION_DEFS[section].about}

${withAverage(scenarios[section])
  .map(
    (s) =>
      `- [${s.variation}](${abs(`${scenarioPath(section, s.variation)}.md`)}): ${DESCRIPTIONS[s.variation] ?? "Published, with no description yet."}`,
  )
  .join("\n")}`,
).join("\n")}
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
