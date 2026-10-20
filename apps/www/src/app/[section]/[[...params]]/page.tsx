import type { Metadata } from "next";
import { Fragment, Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { InlineCode, Marked } from "@/components/inline-code";
import { Button } from "@/components/ui/button";
import { TimeSeriesChart } from "@/components/charts-echarts";
import { BarFigure, GroupedBarFigure } from "@/components/charts-figures";
import { ToolLegend } from "@/components/chart-legend";
import { FixtureTimeSeries } from "@/components/fixture-trend";
import { TabbedFigure } from "@/components/tabbed-figure";
import { NoData } from "@/components/no-data";
import { Callout, Figure, ReportSection, Stat } from "@/components/report";
import { DataAndSource } from "@/components/raw-results";
import { FixtureMenu } from "@/components/fixture-menu";
import { PathSkeleton } from "@/components/path-skeleton";
import { PendingLink, PendingProvider, PendingRegion } from "@/components/report-pending";
import {
  DESCRIPTION,
  FINDING,
  FIXTURE_MENU,
  MENUS,
  ReportHead,
  ReportIntro,
  TITLE,
  TOOLS_MENU,
  TOP,
  Trail,
} from "@/components/report-shell";
import { SelectionChips, type ServerChip } from "@/components/selection-chips";
import { ShowAllTools, ToolsMenu } from "@/components/tools-menu";
import { CountTable, Leaderboard, PerFixtureTable, TrendByTool } from "@/components/sections";
import { TOCMinimap } from "@/components/toc-minimap";
import { FixtureName, ToolName } from "@/components/tool-name";
import { formatDuration, longDate } from "@/lib/findings";
import { fixtureBars } from "@/lib/figures";
import { pageMetadata } from "@/lib/metadata";
import { ogFigure } from "@/lib/og-figure";
import { loadReportParams, reportHref, reportParams } from "@/lib/params";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { loadReport } from "@/lib/report";
import { withAverage } from "@/lib/scenarios";
import { isSectionId, SECTION_DEFS, SECTIONS } from "@/lib/sections";
import { fixtureLabel, toolLabel } from "@/lib/tools";

/* Every scenario of the latest run, so each prerenders its shell; any other renders it on demand. */
export const generateStaticParams = async () => {
  const { scenarios } = await loadCatalog(dataClient());
  return SECTIONS.flatMap((section) =>
    withAverage(scenarios[section]).map((s) => ({ section, params: [s.variation] })),
  );
};

/** "Package managers — vlt benchmarks": the section names the page, whatever the scenario. */
export const generateMetadata = async ({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; params?: string[] }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> => {
  const { section, params: rest = [] } = await params;
  if (!isSectionId(section)) return {};
  const def = SECTION_DEFS[section];
  const path = ["", section, ...rest].map(encodeURIComponent).join("/");
  /* The card shows this run and fixture; every other parameter changes nothing on it --
     but a link to one figure (`?figure=`, see lib/og-figure.ts) gets that figure's card,
     over the window and without the tools hidden on the page it links to. */
  const query = await loadReportParams(searchParams);
  const { fixture, date } = query;
  const raw = (await searchParams)["figure"];
  const figure = ogFigure(typeof raw === "string" ? raw : null);
  const card = new URL(
    reportHref(`/og${path}`, {
      fixture,
      date,
      ...(figure === null
        ? {}
        : { hide: query.hide, range: query.range, from: query.from, to: query.to }),
    }),
    "http://card",
  );
  if (figure !== null) card.searchParams.set("figure", figure);
  const image = `${card.pathname}${card.search}`;
  return pageMetadata({
    title: def.label,
    description: def.about,
    path,
    image,
  });
};
/**
 * A benchmark's report, for one scenario.
 *
 * The BENCHMARK and the SCENARIO are chosen in the sidebar (or its search,
 * ⌘K). The page opens on one row, level with the sidebar's search: the
 * breadcrumb trail on the left, the tools and fixture menus on the right.
 * Beneath it any other non-default selection as a chip that undoes it, then
 * the scenario's badge and what was found, as the page's h1. Under it what was
 * on disk before each run, and what the scenario is, running into the lede.
 *
 * `/{section}` redirects to `/{section}/average`, query kept (next.config.ts):
 * the derived view, the mean of the measured scenarios. Where there are fewer
 * than two to average, the report redirects on to the section's first scenario.
 *
 * Everything here but the report is the shell, shared by every link to a
 * report and prefetched; the report reads the address and streams in.
 */
const Page = ({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; params?: string[] }>;
  searchParams: Promise<SearchParams>;
}) => (
  <Suspense
    fallback={
      <Suspense>
        <PathSkeleton />
      </Suspense>
    }
  >
    <Report params={params} searchParams={searchParams} />
  </Suspense>
);

type SearchParams = { [key: string]: string | string[] | undefined };

/** The report itself: everything that waits on the data. */
const Report = async ({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; params?: string[] }>;
  searchParams: Promise<SearchParams>;
}) => {
  const { section, params: rest } = await params;
  if (!isSectionId(section)) notFound();
  const requested = rest?.[0] === undefined ? undefined : decodeURIComponent(rest[0]);
  const def = SECTION_DEFS[section];
  const query = await loadReportParams(searchParams);
  const result = await loadReport({ section, scenario: requested, query });

  if (result.status === "unknown-section") notFound();
  if (result.status === "no-dates") {
    return (
      <>
        <div className="typeset typeset-docs">
          <h1 className={TITLE}>{def.label}</h1>
        </div>
        <p className={`mt-4 ${DESCRIPTION}`}>
          The served tree reports no dates. There is nothing to show.
        </p>
      </>
    );
  }
  /*
   * `/{section}` opens on the section's average (or its first scenario), and
   * so does a scenario this date did not publish (a stale link, a pinned old
   * run): by redirect, query kept, so the address -- and the sidebar's current
   * item -- name what is on screen. Temporary: whether a date has an average
   * depends on what it published.
   */
  if (result.status === "unknown-scenario") redirect(result.href);

  const pinned = result.status === "ok" ? result.report.filters.date : null;
  const sectionHref = reportHref(`/${section}`, { ...query, date: pinned });

  if (result.status === "no-results") {
    return (
      <>
        <div className={TOP}>
          <Trail label={def.label} sectionHref={sectionHref} />
        </div>
        <div className="typeset typeset-docs mt-10">
          <h1 className={TITLE}>{def.label}</h1>
        </div>
        <h2 className={`mt-12 ${FINDING}`}>No {def.label.toLowerCase()} results in this run.</h2>
        <NoData section={section} date={result.date} availableDates={result.availableDates} />
      </>
    );
  }

  const report = result.report;
  const { scenario, run, filters, finding, baseline, caveats, trend } = report;
  const { date } = run;
  const { fixture, hide: hidden } = filters;
  const { measure, isScript, outline, ranked, publishedFixtures, path } = report;

  const visible = (tool: string) => !hidden.includes(tool);
  const name = (tool: string) => toolLabel(tool, section);
  const named = (tool: string) => ({ tool, label: name(tool) });
  const baselineName = baseline === null ? null : name(baseline);

  const timeBars = report.timeBars;
  const perPackageBars = report.perPackageBars;
  /* What the chart needs of each run besides its plotted means. */
  const trendDetail = trend.points.map(
    ({
      byTool: _byTool,
      perPackage: _perPackage,
      perPackageByFixture: _perPackageByFixture,
      ...rest
    }) => rest,
  );
  const fixtureCount = report.fixtures.length;
  const across =
    fixture !== null
      ? `on the ${fixtureLabel(fixture)} fixture`
      : `across ${fixtureCount} ${fixtureCount === 1 ? "fixture" : "fixtures"}`;
  /* Axis titles: the quantity and what it is taken over, in words. */
  const over = fixture !== null ? `on ${fixtureLabel(fixture)}` : `across ${fixtureCount} fixtures`;
  const timeAxis =
    fixtureCount === 1
      ? `${isScript ? "Execution" : "Install"} time ${over}`
      : `Mean ${measure} time ${over}`;
  const toolAxis =
    section === "registries"
      ? "Registry"
      : section === "task-runners"
        ? "Task runner"
        : "Package manager";

  /** A section holding one table is headed by that table: no title said twice. */
  const solo = new Set(
    outline
      .filter((part) => part.items.length === 1 && part.items[0]?.kind === "table")
      .flatMap((part) => part.items.map((item) => item.id)),
  );
  const level = (id: string): 2 | 3 => (solo.has(id) ? 2 : 3);

  /**
   * What a bar figure's guide may say about the baseline: only what is on
   * screen. The dashed outline and rule are described only if the baseline's
   * bar is drawn. If the baseline is hidden, neither is drawn, and the guide
   * says only what the multiples are still against. If this figure has no
   * baseline at all, it says nothing.
   */
  const baselineGuide = (bars: readonly { tool: string }[]): string => {
    if (baselineName === null || !bars.some((b) => b.tool === baseline)) return "";
    return visible(baseline ?? "")
      ? ` Dashed outline and dashed rule: the baseline, ${baselineName}.`
      : ` Multiples are against the baseline, ${baselineName}, which is hidden.`;
  };

  /* Each fixture's bars, for the reader's tools: hidden tools are neither drawn nor named. */
  const onEachFixture = (rows: typeof report.timeRows) =>
    fixtureBars(rows).map((f) => ({
      fixture: f.fixture,
      bars: f.bars
        .filter((b) => visible(b.tool))
        .map((b) => ({ ...named(b.tool), value: b.value })),
      failed: f.failed.filter(visible).map(name),
      reference: f.bars.find((b) => b.tool === baseline)?.value,
    }));
  /* Every tool these files hold, hidden ones too: the legends list them all. */
  const byFixtureTools = [...ranked, ...report.unranked].map(named);

  const bodies: { [itemId: string]: React.ReactNode } = {
    "leaderboard-table": (
      <Figure
        id="leaderboard-table"
        kind="table"
        level={level("leaderboard-table")}
        title="Leaderboard"
        guide={
          <>
            Lower is faster. ± is the pooled relative standard deviation.
            {trend.points.length > 1
              ? ` Since last run compares with ${longDate(trend.points.at(-2)?.date ?? date)}.`
              : ""}
          </>
        }
        notes={caveats.leaderboard}
      >
        <Leaderboard
          section={section}
          rows={report.leaderboard}
          runs={trend.inFocus.length}
          baseline={baseline}
          fixtureCount={fixtureCount}
          trendEndsHere={trend.endsHere}
          hidden={hidden}
        />
      </Figure>
    ),
    "trend-by-tool": (
      <Figure id="trend-by-tool" kind="line" title="Trend by tool" guide={trend.cut ?? undefined}>
        <TrendByTool section={section} means={report.means} trend={trend.inFocus} hidden={hidden} />
      </Figure>
    ),
    "time-bars": (
      <Figure
        id="time-bars"
        kind="bar"
        title={`Total ${measure} time by tool`}
        guide={
          <>
            Lower is faster. Bars start at zero, each a bright cap on its tool&apos;s colour,
            labelled with its time and its multiple of the baseline.
            {baselineGuide(timeBars.bars)}
          </>
        }
        notes={caveats.timeBars}
      >
        <BarFigure
          bars={timeBars.bars
            .filter((b) => visible(b.tool))
            .map((b) => ({ ...named(b.tool), value: b.value }))}
          unit="s"
          baseline={baseline}
          reference={timeBars.bars.find((b) => b.tool === baseline)?.value}
          xLabel={timeAxis}
          yLabel={toolAxis}
          variant="stripped"
        />
      </Figure>
    ),
    "time-trend": (
      <TimeSeriesChart
        id="time-trend"
        title="Performance over time"
        rows={trend.rows}
        perPackage={trend.perPackage}
        focus={trend.focus}
        /* Tools that completed nothing still ran: the chart marks their DNFs. */
        tools={[...ranked, ...report.unranked].map(named)}
        section={section}
        baseline={baseline}
        markers={trend.markers}
        versions={trend.versions}
        trend={trendDetail}
        yLabel={timeAxis}
        window={{ dates: run.dates, end: date, ...filters.window }}
      />
    ),
    "time-by-fixture": (
      <TabbedFigure
        id="time-by-fixture"
        kind="bar"
        title={`Total ${measure} time by fixture`}
        guide={
          <>
            Lower is faster; bars start at zero, each a bright cap on its tool&apos;s colour. All
            fixtures: a group per fixture, the tools in leaderboard order, as in the legend; hover a
            fixture to read each by name. Each fixture: its tools fastest first, each labelled with
            its time. A tool is drawn on every fixture it finished; a failed run is named, not
            drawn. The legend shows and hides tools everywhere on the page.
            {baselineGuide(timeBars.bars)}
          </>
        }
        tabs={[
          {
            value: "all",
            label: "All fixtures",
            content: (
              <GroupedBarFigure
                fixtures={report.timeRows.map((r) => ({
                  fixture: r.fixture,
                  label: fixtureLabel(r.fixture),
                  values: Object.fromEntries(
                    r.values.filter((v) => visible(v.tool)).map((v) => [v.tool, v.value]),
                  ),
                  failed: r.failed.filter(visible),
                }))}
                tools={byFixtureTools.filter((t) => visible(t.tool))}
                unit="s"
                yLabel={`${isScript ? "Execution" : "Install"} time`}
                legend={
                  <ToolLegend
                    tools={byFixtureTools.map((t) => t.tool)}
                    values={Object.fromEntries(
                      timeBars.bars.map((b) => [b.tool, `${formatDuration(b.value)} mean`]),
                    )}
                    section={section}
                    baseline={baseline}
                  />
                }
              />
            ),
          },
          ...onEachFixture(report.timeRows).map((f) => ({
            value: f.fixture,
            label: <FixtureName key={f.fixture} fixture={f.fixture} />,
            /* Keyed: elements made in a map are validated as a list's children. */
            content: (
              <Fragment key={f.fixture}>
                <BarFigure
                  bars={f.bars}
                  unit="s"
                  baseline={baseline}
                  reference={f.reference}
                  xLabel={`${isScript ? "Execution" : "Install"} time on ${fixtureLabel(f.fixture)}`}
                  yLabel={toolAxis}
                  variant="stripped"
                  legend={
                    <ToolLegend
                      key={f.fixture}
                      tools={byFixtureTools.map((t) => t.tool)}
                      values={Object.fromEntries(
                        report.timeRows
                          .find((r) => r.fixture === f.fixture)
                          ?.values.map((v) => [v.tool, formatDuration(v.value)]) ?? [],
                      )}
                      section={section}
                      baseline={baseline}
                    />
                  }
                />
                {f.failed.length === 0 ? null : (
                  <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                    Did not finish, not drawn: {f.failed.join(", ")}
                  </p>
                )}
              </Fragment>
            ),
          })),
        ]}
      />
    ),
    "time-table": (
      <Figure
        id="time-table"
        kind="table"
        level={level("time-table")}
        title={`Total ${measure} time data`}
        guide={
          <>
            Each cell is the mean time
            {baselineName === null
              ? ""
              : `, with its multiple of ${baselineName} on that fixture beneath`}
            . Bold: fastest on the fixture. DNF: the run exited non-zero and is excluded from every
            figure. A dash: not run on that fixture.
          </>
        }
      >
        <PerFixtureTable
          id="time"
          section={section}
          rows={report.timeRows}
          fixtures={report.fixtures}
          order={ranked}
          baseline={baseline}
          unit="s"
          hidden={hidden}
        />
      </Figure>
    ),
    "per-package-chart": (
      <Figure
        id="per-package-chart"
        kind="bar"
        title="Per-package time by tool"
        guide={
          <>
            Milliseconds per installed package; lower is faster. Tools disagree about what a
            dependency graph contains, so a tool that installs fewer packages finishes sooner
            without being faster — this is the figure that corrects for it.
            {baselineGuide(perPackageBars.bars)}
          </>
        }
        notes={caveats.perPackageBars}
      >
        <BarFigure
          bars={perPackageBars.bars
            .filter((b) => visible(b.tool))
            .map((b) => ({ ...named(b.tool), value: b.value }))}
          unit="ms"
          baseline={baseline}
          reference={perPackageBars.bars.find((b) => b.tool === baseline)?.value}
          xLabel={`${fixtureCount === 1 ? "Time" : "Mean time"} per installed package ${over}`}
          yLabel={toolAxis}
        />
      </Figure>
    ),
    "per-package-by-fixture": (
      <FixtureTimeSeries
        id="per-package-by-fixture"
        title="Per-package time by fixture"
        fixtures={report.trend.perPackageByFixture}
        /* Tools that completed nothing still ran: the chart marks their DNFs. */
        tools={byFixtureTools}
        section={section}
        baseline={baseline}
        markers={trend.markers}
        versions={trend.versions}
        trend={trendDetail}
        focus={trend.focus}
        window={{ dates: run.dates, end: date, ...filters.window }}
      />
    ),
    "per-package-table": (
      <Figure
        id="per-package-table"
        kind="table"
        level={level("per-package-table")}
        title="Per-package time data"
        guide="Bold: fastest on the fixture. A tool with a time but no published package count is left out rather than divided by a guess."
      >
        <PerFixtureTable
          id="per-package"
          section={section}
          rows={report.perPackageRows}
          fixtures={report.fixtures}
          order={ranked}
          baseline={baseline}
          unit="ms"
          hidden={hidden}
        />
      </Figure>
    ),
    "package-count": (
      <Figure
        id="package-count"
        kind="table"
        level={level("package-count")}
        title="Package count"
        guide="A range beneath a count means that tool's installs did not all produce the same number of packages."
      >
        <CountTable
          id="packages"
          section={section}
          rows={report.packageCounts}
          fixtures={report.fixtures}
          empty="No package counts published for this scenario."
          hidden={hidden}
        />
      </Figure>
    ),
    "process-count": (
      <Figure
        id="process-count"
        kind="table"
        level={level("process-count")}
        title="Spawned processes"
      >
        <CountTable
          id="processes"
          section={section}
          rows={report.processCounts}
          fixtures={report.fixtures}
          empty="No process counts published for this scenario."
          hidden={hidden}
        />
      </Figure>
    ),
  };

  /* The non-default selections the menus beside them do not already show,
     as resolved: a value the page ignored gets no chip. */
  const chips: ServerChip[] = [
    ...(filters.window.custom
      ? [
          {
            label: "window",
            value: `${longDate(filters.window.from)} – ${longDate(filters.window.to)}`,
            clear: ["from", "to", "range"] as const,
          },
        ]
      : query.range === reportParams.range.defaultValue
        ? []
        : [
            {
              label: "window",
              value: `${query.range} days`,
              clear: ["range", "from", "to"] as const,
            },
          ]),
    ...(trend.focus === null
      ? []
      : [
          {
            label: "focus",
            value: `${longDate(trend.focus.from)} – ${longDate(trend.focus.to)}`,
            clear: ["focus"] as const,
          },
        ]),
    ...(filters.exclude.length === 0
      ? []
      : [
          {
            label: "exclusions",
            value: String(filters.exclude.length),
            clear: ["exclude"] as const,
          },
        ]),
  ];
  const metric =
    query.metric === "total" || (query.metric === "per-package" && !trend.perPackage)
      ? null
      : query.metric;

  return (
    <PendingProvider>
      <ReportHead
        section={section}
        variation={scenario.variation}
        sectionHref={sectionHref}
        menus={
          <div className={MENUS}>
            <ToolsMenu tools={ranked} section={section} className={TOOLS_MENU} />
            {publishedFixtures.length < 2 ? null : (
              <FixtureMenu fixtures={publishedFixtures} className={FIXTURE_MENU} />
            )}
          </div>
        }
        chips={
          <SelectionChips server={chips} metric={metric} runs={trend.points.map((p) => p.date)} />
        }
      />

      <PendingRegion>
        <ReportIntro
          section={section}
          variation={scenario.variation}
          averaged={scenario.averageOf?.scenarios.length}
          finding={finding.marked}
          lede={
            <>
              Mean {measure} time {across}
              {scenario.averageOf === null ? (
                <>
                  {" "}
                  in the <InlineCode>{scenario.variation}</InlineCode> scenario
                </>
              ) : (
                `, averaged over ${scenario.averageOf.scenarios.length} scenarios`
              )}
              , from the run of {longDate(date)} on GitHub-hosted{" "}
              <span className="whitespace-nowrap">ubuntu-24.04-arm</span> runners.
              {section === "registries"
                ? " Every registry is installed from with the same npm client."
                : ""}
              {run.isLatest ? null : " This is not the latest run."}
            </>
          }
          action={
            run.isLatest ? undefined : (
              <Button asChild size="sm">
                <PendingLink href={path}>
                  See the latest run
                  <ArrowRight aria-hidden />
                </PendingLink>
              </Button>
            )
          }
        />
        {caveats.qualifier === null ? null : (
          <div className="mt-6">
            <Callout title="A faster mean is not ranked">
              <Marked text={caveats.qualifier} />
            </Callout>
          </div>
        )}

        {report.stats === null ? null : (
          <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {report.stats.map((stat) => (
              <Stat
                key={stat.label}
                label={stat.label}
                value={stat.value}
                detail={
                  stat.tool === undefined ? (
                    stat.detail
                  ) : (
                    <ToolName tool={stat.tool} section={section} />
                  )
                }
              />
            ))}
          </dl>
        )}

        {caveats.hidden === null ? null : (
          <div className="mt-10">
            <Callout title={caveats.hidden.title}>
              {caveats.hidden.body}{" "}
              <ShowAllTools className="text-foreground underline underline-offset-4" />
            </Callout>
          </div>
        )}

        {caveats.disclosure === null ? null : (
          <p className="mt-10 max-w-[78ch] text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Disclosure.</span> {caveats.disclosure}
          </p>
        )}

        {outline.map((part) => (
          <ReportSection
            key={part.id}
            id={part.id}
            title={part.items.every((item) => solo.has(item.id)) ? undefined : part.title}
          >
            {part.items.map((item) => (
              <Fragment key={item.id}>{bodies[item.id]}</Fragment>
            ))}
          </ReportSection>
        ))}
        <DataAndSource raw={report.raw} />
      </PendingRegion>
      {/* Fixed to the viewport's right edge, in the page margin: no column. */}
      <TOCMinimap
        items={outline.flatMap((part) => [
          { url: `#${part.id}`, title: part.title, depth: 2 },
          ...(part.items.every((item) => solo.has(item.id))
            ? []
            : part.items.map((item) => ({
                url: `#${item.id}`,
                title: item.label,
                depth: 3,
              }))),
        ])}
      />
    </PendingProvider>
  );
};

export default Page;
