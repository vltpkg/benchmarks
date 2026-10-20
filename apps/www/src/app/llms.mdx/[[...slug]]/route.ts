import { GET as llmsTxt } from "@/app/llms.txt/route";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { methodologyMarkdown } from "@/app/methodology/markdown";
import { reportMarkdown } from "@/lib/markdown";
import { siteOrigin } from "@/lib/metadata";
import { loadReportParams } from "@/lib/params";
import { ignoredSelection, loadReport } from "@/lib/report";
import { SECTION_DEFS } from "@/lib/sections";

// `Vary` because the same url serves html to browsers
const markdown = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept" },
  });

// reached through the `Accept: text/markdown` and `/:path+.md` rewrites in next.config.ts
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) => {
  const { slug = [] } = await params;
  const origin = siteOrigin(request);
  const abs = (path: string) => new URL(path, origin).href;
  // the About page (once the landing page) is cards and links, so its markdown is the llms.txt index
  // `/about` is that page now; `/` redirects to the default benchmark
  if (slug.length === 0 || slug.join("/") === "about") {
    return markdown(await (await llmsTxt(request)).text());
  }
  if (slug.join("/") === "methodology") {
    return markdown(methodologyMarkdown((await loadCatalog(dataClient())).scenarios, origin));
  }

  const path = `/${slug.join("/")}`;
  // a body agents can act on; `notFound()` would send an empty one
  const missing = (detail = "") =>
    markdown(
      `# 404: Page not found\n\nThere is no page at \`${path}\` on vlt benchmarks.${detail}\n\n- [llms.txt](${abs("/llms.txt")}) lists every page, each available as Markdown\n- [openapi.json](${abs("/openapi.json")}) describes the JSON API\n- [Home](${abs("/")})\n`,
      404,
    );

  const [section = "", scenario, ...extra] = slug.map(decodeURIComponent);
  if (extra.length > 0) return missing();
  const query = loadReportParams(new URL(request.url).searchParams);
  let result = await loadReport({ section, scenario, query });
  // `/{section}` opens on its average (or first scenario), as the page does
  if (result.status === "unknown-scenario" && scenario === undefined) {
    result = await loadReport({ section, scenario: result.opens, query });
  }

  switch (result.status) {
    case "unknown-section":
      return missing();
    case "unknown-scenario":
      return missing(
        ` Scenarios ${SECTION_DEFS[result.section].label} published in this run: ${result.scenarios.map((s) => `\`${s}\``).join(", ")}.`,
      );
    case "no-dates":
      return markdown(
        `# ${SECTION_DEFS[result.section].label}\n\nThe served tree reports no dates. There is nothing to show.\n`,
      );
    case "no-results":
      return markdown(
        `# ${SECTION_DEFS[result.section].label}\n\nNo ${SECTION_DEFS[result.section].label.toLowerCase()} results in the run of ${result.date}.${result.availableDates.length === 0 ? "" : ` Recent runs that did publish them: ${result.availableDates.map((d) => `[${d}](${abs(`/${result.section}.md?date=${d}`)})`).join(", ")}.`}\n`,
      );
    case "ok": {
      const ignored = ignoredSelection(query, result.report);
      const body = reportMarkdown(result.report, origin);
      return markdown(
        ignored === null
          ? body
          : `> ${ignored} This is the report without that selection.\n\n${body}`,
      );
    }
  }
};
