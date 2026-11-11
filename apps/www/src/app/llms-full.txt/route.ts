import { createLlmsFullHandler } from "@affordances/md/next";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { reportMarkdown, TWIN_CACHE } from "@/lib/markdown";
import { siteOrigin } from "@/lib/metadata";
import { loadReportParams } from "@/lib/params";
import { loadReport } from "@/lib/report";
import { scenarioPath, withAverage } from "@/lib/scenarios";
import { SECTIONS } from "@/lib/sections";

/*
 * Every scenario of the latest run at the default view, from the Markdown
 * builder rather than rendered: a page whose report throws makes the file a
 * 503 that's never cached, not a cached file without it.
 */
export const GET = createLlmsFullHandler({
  publicCache: TWIN_CACHE,
  pages: async (request) => {
    const client = dataClient();
    const { scenarios } = await loadCatalog(client);
    const query = loadReportParams(new URLSearchParams());
    return SECTIONS.flatMap((section) =>
      withAverage(scenarios[section]).map(({ variation }) => ({
        url: new URL(scenarioPath(section, variation), siteOrigin(request)).href,
        markdown: async () => {
          const result = await loadReport({ section, scenario: variation, query, client });
          return result.status === "ok" ? reportMarkdown(result.report, siteOrigin(request)) : "";
        },
      })),
    );
  },
});
