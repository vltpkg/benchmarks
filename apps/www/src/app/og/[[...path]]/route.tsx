import { dataClient } from "@/lib/data";
import { SITE_TAGLINE, siteOrigin } from "@/lib/metadata";
import { renderOgImage } from "@/lib/opengraph/takumi";
import { ogFigure } from "@/lib/og-figure";
import { FigureCard, ReportCard, SiteCard, toolColors } from "@/lib/opengraph/templates";
import { loadReportParams } from "@/lib/params";
import { loadReport } from "@/lib/report";
import { isSectionId, SECTION_DEFS } from "@/lib/sections";

/* The latest run changes nightly; a pinned one does not. */
const LATEST = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
const PINNED = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";
const FAILED = "public, max-age=300, s-maxage=300";

/**
 * A page's social card: `/og/{section}/{scenario}` with the page's `fixture`
 * and `date`, and `/og` for the site. Anything that names no report -- an
 * unknown path, a benchmark with nothing published -- gets the site card,
 * with the benchmark's name where there is one. Other parameters are ignored:
 * nothing else changes what the card says -- except on a figure's card
 * (`figure`, from a link to it), which draws the trend window and leaves out
 * the hidden tools, as the page it links to does.
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) => {
  const path = (await params).path ?? [];
  const [section, scenario] = path;
  const host = new URL(siteOrigin()).host;
  if (section === undefined || !isSectionId(section) || path.length > 2) {
    return renderOgImage(<SiteCard eyebrow={host} title={SITE_TAGLINE} />, LATEST);
  }
  const def = SECTION_DEFS[section];
  const benchmark = (cache: string) =>
    renderOgImage(<SiteCard eyebrow={host} title={def.label} description={def.about} />, cache);
  if (scenario === undefined) return benchmark(LATEST);

  try {
    const search = new URL(request.url).searchParams;
    const asked = loadReportParams(search);
    const { fixture, date } = asked;
    const figure = ogFigure(search.get("figure"));
    const client = dataClient();
    const index = await client.getIndex();
    const pinned = date !== null && index.dates.includes(date);
    const run = pinned ? date : index.latest;
    const defaults = loadReportParams(new URLSearchParams());
    const result = await loadReport({
      section,
      scenario: decodeURIComponent(scenario),
      query:
        figure === null
          ? /* A one-run trend window: the card draws no trend, so none is fetched. */
            { ...defaults, fixture, date, from: run, to: run }
          : {
              ...defaults,
              fixture,
              date,
              hide: asked.hide,
              range: asked.range,
              from: asked.from,
              to: asked.to,
            },
      client,
    });
    if (result.status !== "ok") return benchmark(LATEST);
    const colors = await toolColors();
    return renderOgImage(
      figure === null ? (
        <ReportCard report={result.report} colors={colors} />
      ) : (
        <FigureCard report={result.report} figure={figure} colors={colors} />
      ),
      pinned ? PINNED : LATEST,
    );
  } catch {
    return benchmark(FAILED);
  }
};
