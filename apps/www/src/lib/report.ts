/**
 * One scenario's report, loaded and shaped once: what the HTML page draws,
 * what the Markdown twin writes out, what the API returns and what the MCP
 * tools answer with. Data only, so it serialises as it is.
 *
 * Everything here reads measurement files. `chart-data.json` is never
 * consulted: on 2026-04-14 it describes registry data that does not exist,
 * and the same file is the source of the section lists this report refuses
 * to trust.
 */
import { benchmarkFile, type DataClient } from "@benchmarks/data";
import type { Fixture, Versions } from "@benchmarks/types";
import type { inferParserType } from "nuqs/server";
import { publishedVariations } from "./catalog";
import { toDenseChartRows } from "./chart-model";
import { citeFor, type Citation } from "./cite";
import { dataClient, probe } from "./data";
import { flagOutliers, meanBars, type Bar } from "./figures";
import { formatDuration, formatRatio, type Finding } from "./findings";
import { scenarioFacts, scopedFinding } from "./headline";
import {
  averageTrendDates,
  loadAverage,
  loadScenario,
  loadSummaries,
  type TrendPoint,
} from "./load";
import {
  countRows,
  perPackageByFixture,
  ratioTo,
  type CountRow,
  type FixtureRow,
  type ToolMean,
} from "./measurements";
import { buildOutline, fixturesWith, type OutlineSection } from "./outline";
import { reportHref, reportParams, trendWindow } from "./params";
import {
  DESCRIPTIONS,
  scenarioPath,
  scenariosFor,
  stateParts,
  withAverage,
  type ScenarioKind,
  type ScenarioState,
} from "./scenarios";
import { isSectionId, SECTION_DEFS, sectionOf, type SectionId } from "./sections";
import { fixtureLabel, toolLabel } from "./tools";
import {
  markersForTools,
  versionMarkers,
  type DatedVersions,
  type VersionMarker,
} from "./version-markers";

export type ReportQuery = inferParserType<typeof reportParams>;

/** A caveat: what it is about, in a line, then what it means. */
export interface ReportNote {
  readonly title: string;
  readonly body: string;
}

export interface ReportStat {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  /** The tool `detail` names, when it names one. */
  readonly tool?: string;
}

export interface LeaderboardRow {
  readonly tool: string;
  readonly label: string;
  /** Rank among ALL tools, hidden ones included. */
  readonly rank: number;
  /** Mean seconds. */
  readonly mean: number;
  /** Pooled relative standard deviation, as a fraction. */
  readonly rsd: number;
  /** Baseline mean over this tool's; `null` when the baseline was not measured. */
  readonly ratio: number | null;
  readonly isBaseline: boolean;
  /** Change since the previous run, as a fraction; `null` when there is none to compare. */
  readonly sinceLastRun: number | null;
  /** Fixtures that contributed to the mean. */
  readonly fixtures: number;
  /** A run exited non-zero and is excluded from the mean. */
  readonly failed: boolean;
  readonly version: string | null;
  /** The tool's plotted value on each run in the trend, holes as `null`. */
  readonly series: readonly (number | null)[];
}

export interface ReportModel {
  readonly section: { readonly id: SectionId; readonly label: string; readonly about: string };
  readonly scenario: {
    readonly variation: string;
    readonly kind: ScenarioKind;
    readonly uncurated: boolean;
    readonly description: string;
    readonly state: ScenarioState;
    /** What was on disk before each run; `null` where the name encodes no state. */
    readonly stateParts: ReturnType<typeof stateParts> | null;
    /** On the derived view, the scenarios averaged, in all and on each fixture shown; `null` on a measured one. */
    readonly averageOf: {
      readonly scenarios: readonly string[];
      readonly byFixture: { readonly [fixture: string]: readonly string[] };
    } | null;
  };
  readonly run: {
    readonly date: string;
    readonly latest: string;
    readonly isLatest: boolean;
    /** Every published date, ascending. */
    readonly dates: readonly string[];
  };
  /** The scenario's page, unpinned. */
  readonly path: string;
  /** The selections in effect, as resolved: a value the report ignored is not here. */
  readonly filters: {
    /** The pinned date, or `null` for the latest. */
    readonly date: string | null;
    readonly fixture: string | null;
    readonly range: ReportQuery["range"];
    readonly window: { readonly from: string; readonly to: string; readonly custom: boolean };
    readonly hide: readonly string[];
    readonly metric: ReportQuery["metric"];
    readonly exclude: readonly string[];
    readonly y: string | null;
  };
  readonly isScript: boolean;
  readonly measure: "install" | "execution";
  /** Every fixture this scenario published on this date. */
  readonly publishedFixtures: readonly string[];
  /** The fixtures the numbers are over: all of them, or the one selected. */
  readonly fixtures: readonly string[];
  readonly tools: readonly string[];
  /** Tools with a mean, fastest first. */
  readonly ranked: readonly string[];
  /** Tools that ran and completed no fixture. */
  readonly unranked: readonly string[];
  readonly baseline: string | null;
  readonly finding: Finding;
  /** The four headline numbers; `null` when the finding names no tool. */
  readonly stats: readonly ReportStat[] | null;
  readonly means: readonly ToolMean[];
  readonly leaderboard: readonly LeaderboardRow[];
  readonly timeRows: readonly FixtureRow[];
  readonly perPackageRows: readonly FixtureRow[];
  readonly timeBars: { readonly bars: readonly Bar[]; readonly partial: readonly string[] };
  readonly perPackageBars: { readonly bars: readonly Bar[]; readonly partial: readonly string[] };
  readonly packageCounts: readonly CountRow[];
  readonly processCounts: readonly CountRow[];
  readonly outline: readonly OutlineSection[];
  readonly trend: {
    readonly points: readonly TrendPoint[];
    /** One row per calendar day, holes as `null`, in the plotted metric. */
    readonly rows: readonly { date: string; [tool: string]: string | number | null }[];
    /** What `rows` holds: total seconds, or milliseconds per installed package. */
    readonly plotted: "total" | "per-package";
    /** Whether per-package can be plotted here at all. */
    readonly perPackage: boolean;
    /** Each fixture's milliseconds per installed package, one row per calendar day, holes as `null`. */
    readonly perPackageByFixture: readonly {
      readonly fixture: string;
      readonly rows: readonly { date: string; [tool: string]: string | number | null }[];
    }[];
    /** Whether the window ends at the run shown, so "since last run" is about it. */
    readonly endsHere: boolean;
    /** Each date's client versions; empty where the keys name registries. */
    readonly versions: readonly DatedVersions[];
    readonly markers: readonly VersionMarker[];
    /** Runs far from their neighbours, with the deviation from their median as a fraction. */
    readonly outliers: readonly { tool: string; date: string; deviation: number }[];
    /** Why the trend covers fewer runs than its window, when it does. */
    readonly cut: string | null;
    /** The brush's focus inside the window, when one is set and valid. */
    readonly focus: { readonly from: string; readonly to: string } | null;
    /** `points` within the focus; all of them without one. */
    readonly inFocus: readonly TrendPoint[];
  };
  readonly caveats: {
    /** The finding's qualifier, tool names between backticks. */
    readonly qualifier: string | null;
    readonly leaderboard: readonly ReportNote[];
    readonly timeBars: readonly ReportNote[];
    readonly perPackageBars: readonly ReportNote[];
    readonly hidden: ReportNote | null;
    readonly disclosure: string | null;
  };
  /** The result files this report was drawn from, by the URL they were fetched at. */
  readonly raw: readonly {
    readonly fixture: string;
    readonly scenario: string;
    readonly label: string;
    readonly href: string;
  }[];
  /** The citation, and the path it cites: this view pinned to its date. */
  readonly citation: Citation & { readonly path: string };
}

export type ReportResult =
  | { readonly status: "ok"; readonly report: ReportModel }
  | { readonly status: "unknown-section"; readonly section: string }
  | { readonly status: "no-dates"; readonly section: SectionId }
  /** The run published nothing for this section. */
  | {
      readonly status: "no-results";
      readonly section: SectionId;
      readonly date: string;
      readonly availableDates: readonly string[];
    }
  /** No scenario named, or one this run did not publish: the page opens on `opens`. */
  | {
      readonly status: "unknown-scenario";
      readonly section: SectionId;
      readonly requested: string | undefined;
      readonly scenarios: readonly string[];
      /** The derived average, or the first scenario where there is none to average. */
      readonly opens: string;
      /** Its page, query kept. */
      readonly href: string;
    };

/**
 * Dates near the newest that did publish this section.
 *
 * Bounded on purpose: at most five shard fetches. Scanning all 352 shards to
 * offer a complete list would cost more than the suggestion is worth, and the
 * copy says "recent runs" rather than claiming the list is exhaustive.
 */
const recentDatesWithSection = async (
  client: DataClient,
  dates: readonly string[],
  section: string,
  exclude: string,
): Promise<string[]> => {
  const candidates = dates
    .filter((d) => d !== exclude)
    .slice(-5)
    .reverse();
  const checked = await Promise.all(
    candidates.map(async (date) => {
      try {
        const entry = await client.getDirectoryEntry(date);
        return publishedVariations(entry).some((v) => sectionOf(v) === section) ? date : null;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((d): d is string => d !== null);
};

const names = (tools: readonly string[], section: SectionId) =>
  tools.map((t) => toolLabel(t, section)).join(", ");

const partialNotes = (tools: readonly string[], section: SectionId): ReportNote[] =>
  tools.length === 0
    ? []
    : [
        {
          title: `Not drawn: ${names(tools, section)}`,
          body: `A bar is a mean over every fixture, and ${tools.length === 1 ? "this tool" : "these tools"} did not complete every one.`,
        },
      ];

export const loadReport = async ({
  section,
  scenario,
  query,
  client = dataClient(),
}: {
  section: string;
  scenario?: string;
  query: ReportQuery;
  client?: DataClient;
}): Promise<ReportResult> => {
  if (!isSectionId(section)) return { status: "unknown-section", section };
  const def = SECTION_DEFS[section];
  const index = await client.getIndex();

  /* A date the archive does not hold falls back to the latest, not to a 404. */
  const pinned = query.date !== null && index.dates.includes(query.date) ? query.date : null;
  const date = pinned ?? index.latest;
  if (date === null || index.latest === null) return { status: "no-dates", section };

  const entry = await client.getDirectoryEntry(date);
  const scenarios = scenariosFor(section, publishedVariations(entry));
  const listed = withAverage(scenarios);
  const selected = listed.find((s) => s.variation === scenario);
  const first = listed[0];
  if (first === undefined) {
    return {
      status: "no-results",
      section,
      date,
      availableDates: await recentDatesWithSection(client, index.dates, section, date),
    };
  }
  if (selected === undefined) {
    return {
      status: "unknown-scenario",
      section,
      requested: scenario,
      scenarios: scenarios.map((s) => s.variation),
      opens: first.variation,
      href: reportHref(scenarioPath(section, first.variation), { ...query, date: pinned }),
    };
  }

  const averageOf = selected.averageOf ?? null;
  /* The derived view: each fixture, and the scenarios averaged on it. */
  const plan: { [fixture: string]: readonly string[] } = Object.fromEntries(
    Object.entries(entry.benchmarks)
      .map(([f, published]): [string, string[]] => [
        f,
        (averageOf ?? []).filter((v) => published?.includes(v)),
      ])
      .filter(([, averaged]) => averaged.length > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const publishedFixtures =
    averageOf === null ? fixturesWith(entry.benchmarks, selected.variation) : Object.keys(plan);

  /*
   * One fixture, or all of them. A fixture this scenario did not publish --
   * a stale link, or one carried over from another scenario -- is ignored,
   * and the report covers all fixtures rather than none.
   */
  const fixture =
    query.fixture !== null && publishedFixtures.includes(query.fixture) ? query.fixture : null;
  const fixtures = fixture === null ? publishedFixtures : [fixture];
  const isScript = selected.kind === "other" && section === "task-runners";

  const outline = buildOutline({
    fixtures,
    packageCountFixtures: fixturesWith(entry.packageCounts, selected.variation).filter((f) =>
      fixtures.includes(f),
    ),
    processCountFixtures: fixturesWith(entry.processCounts, selected.variation).filter((f) =>
      fixtures.includes(f),
    ),
    isScript,
  });

  /*
   * Trend window: a preset number of calendar days ending at this run, or an
   * exact from/to. Resolved and validated in `trendWindow`.
   *
   * By TIME, not by count. The archive is missing 53 calendar days, so "the
   * last 16 runs" can reach back the better part of a year, and a line joining
   * runs ten months apart is not a trend -- it is two unrelated states drawn
   * as a slope. Every window is inside MAX_DENSE_DAYS (120), so the axis is
   * always spaced by real calendar time and a gap is always a gap.
   */
  const window = trendWindow({
    dates: index.dates,
    end: date,
    range: query.range,
    from: query.from,
    to: query.to,
  });

  /*
   * Exclusions apply to every trend; the run being shown cannot be one of
   * them -- the report's numbers are about it.
   */
  const exclude = query.exclude.filter((e) => e.split("@").at(-1) !== date);
  /* The derived view's trend reads each run's summary; a run without one is cut to what the request budget allows. */
  const shownPlan = Object.fromEntries(fixtures.map((f) => [f, plan[f] ?? []]));
  const filesPerRun = Object.values(shownPlan).flat().length;
  const summaries = averageOf === null ? undefined : await loadSummaries(client, window.dates);
  const trendDates =
    summaries === undefined
      ? window.dates
      : averageTrendDates(window.dates, filesPerRun, new Set(summaries.keys()));
  const average =
    averageOf === null
      ? null
      : await loadAverage(client, date, shownPlan, trendDates, { exclude, summaries });
  const data =
    average ??
    (await loadScenario(client, date, selected.variation, fixtures, trendDates, {
      exclude,
      /* The per-package figures by fixture draw every run, so the counts are always wanted where there are any. */
      perPackage: section !== "task-runners",
    }));
  const facts = scenarioFacts(
    section,
    data.bundles,
    fixture === null ? null : `On ${fixtureLabel(fixture)}`,
  );
  const { tools, means, timeRows, baseline } = facts;

  const versionSeries = await Promise.all(
    data.trend.map(async (p) => {
      const v = await probe<Versions>(() => client.getVersions(p.date));
      return { date: p.date, versions: v.state === "present" ? v.value : null };
    }),
  );
  const versions = versionSeries.find((v) => v.date === date)?.versions ?? null;
  /*
   * `versions.json` records CLIENT versions. In the registries section the
   * same keys name registries -- `vlt` is registry.vlt.io -- so a marker there
   * would print the vlt client's release as a change to the registry. No
   * markers, no versions, and no versions in the trend's tooltip.
   */
  const hasVersions = section !== "registries";
  const markers = hasVersions ? markersForTools(versionMarkers(versionSeries), tools) : [];

  const ranked = means.map((m) => m.tool);

  /*
   * Tools the reader has hidden (one parameter). A name these files do not
   * contain hides nothing.
   *
   * Hiding removes rows and marks, and the HEADLINE AND ITS STATS take the
   * reader's stance: they are about the tools left, and the sentence opens by
   * naming what is hidden ("With `registry.vlt.io` hidden, ..."), so hiding
   * the fastest never quietly crowns the next. A row's rank and every
   * "fastest" mark in the tables are still over all tools, and every ratio is
   * still against the real baseline, hidden or not. Hiding everything hides
   * nothing from the headline.
   */
  const hidden = query.hide.filter((tool) => ranked.includes(tool));
  const finding = scopedFinding(
    section,
    facts,
    data.bundles.length,
    fixture === null ? null : `On ${fixtureLabel(fixture)}`,
    hidden,
  );
  const name = (tool: string) => toolLabel(tool, section);
  const baselineName = baseline === null ? null : name(baseline);

  const perPackageRows = perPackageByFixture(data.bundles, tools);
  /* Per package, the trend plots the per-package series the loader built. */
  const perPackageTrend = averageOf === null && section !== "task-runners";
  const plotted = perPackageTrend && query.metric === "per-package" ? "per-package" : "total";
  const dense = toDenseChartRows(
    plotted === "per-package"
      ? data.trend.map((p) => ({ date: p.date, byTool: p.perPackage ?? {} }))
      : data.trend,
    tools,
  );
  /* Each fixture's per-package time, run by run, for the per-package figure by fixture. */
  const perPackageTrends = perPackageTrend
    ? fixtures.map((f) => ({
        fixture: f,
        rows: toDenseChartRows(
          data.trend.map((p) => ({
            date: p.date,
            byTool: Object.fromEntries(tools.map((t) => [t, p.perPackageByFixture?.[t]?.[f]])),
          })),
          tools,
        ).rows,
      }))
    : [];
  const measure = isScript ? "execution" : "install";
  const fixtureCount = fixtures.length;
  const partial = means.filter((m) => m.failed || m.fixtures < fixtureCount).map((m) => m.tool);

  /* The brush's focus: both ends runs this trend loaded, in order. */
  const [focusFrom, focusTo] = (query.focus ?? "").split("~");
  const loaded = new Set(data.trend.map((p) => p.date));
  const focus =
    focusFrom !== undefined &&
    focusTo !== undefined &&
    loaded.has(focusFrom) &&
    loaded.has(focusTo) &&
    focusFrom < focusTo
      ? { from: focusFrom, to: focusTo }
      : null;
  const inFocus =
    focus === null
      ? data.trend
      : data.trend.filter((p) => p.date >= focus.from && p.date <= focus.to);

  const previous = data.trend.at(-2);
  const latest = data.trend.at(-1);
  const endsHere = latest?.date === date;
  const baselineMean = means.find((m) => m.tool === baseline)?.mean;
  const leaderboard = means.map((m, i): LeaderboardRow => {
    const prev = previous?.byTool[m.tool];
    const now = latest?.byTool[m.tool] ?? m.mean;
    return {
      tool: m.tool,
      label: name(m.tool),
      rank: i + 1,
      mean: m.mean,
      rsd: m.rsd,
      ratio: ratioTo(m.mean, baselineMean),
      isBaseline: m.tool === baseline,
      sinceLastRun: endsHere && typeof prev === "number" && prev > 0 ? (now - prev) / prev : null,
      fixtures: m.fixtures,
      failed: m.failed,
      version: hasVersions ? (versions?.[m.tool] ?? null) : null,
      // Gaps are kept rather than compacted: dropping them would slide
      // later runs left and misdate the shape of the line.
      series: inFocus.map((p) => p.byTool[m.tool] ?? null),
    };
  });

  const outliers = ranked.flatMap((tool) =>
    flagOutliers(dense.rows.map((r) => (typeof r[tool] === "number" ? r[tool] : null))).flatMap(
      (deviation, i) => {
        const day = dense.rows[i]?.date;
        return deviation === null || day === undefined ? [] : [{ tool, date: day, deviation }];
      },
    ),
  );

  const stats: ReportStat[] | null =
    finding.subject === null || finding.mean === null
      ? null
      : [
          {
            label: `Fastest mean ${measure}`,
            value: formatDuration(finding.mean),
            detail: name(finding.subject),
            tool: finding.subject,
          },
          {
            label: baselineName === null ? "Against the baseline" : `Against ${baselineName}`,
            /* With the fastest hidden, the leader of the rest can be slower than the baseline. */
            value:
              finding.ratio === null
                ? "—"
                : formatRatio(finding.ratio >= 1 ? finding.ratio : 1 / finding.ratio),
            detail:
              finding.ratio !== null
                ? `${finding.ratio >= 1 ? "faster" : "slower"}, on the mean`
                : baseline === null
                  ? "the baseline was not measured here"
                  : "the baseline is among the fastest",
          },
          fixtureCount > 1
            ? {
                label: "Fixtures won",
                value: finding.wins === null ? "—" : `${finding.wins.won} / ${finding.wins.of}`,
                detail: `where ${name(finding.subject)} was fastest outright`,
              }
            : {
                label: "Tools ranked",
                value: String(means.length - (finding === facts.finding ? 0 : hidden.length)),
                detail:
                  finding === facts.finding
                    ? "with a completed run here"
                    : "shown, with a completed run here",
              },
          {
            label: "Spread",
            value: finding.spread === null ? "—" : formatRatio(finding.spread),
            detail:
              finding.spread === null
                ? "needs two tools that completed every fixture"
                : `between the slowest and fastest ${finding === facts.finding ? "" : "shown "}tools that completed every fixture`,
          },
        ];

  const timeBars = meanBars(timeRows);
  const perPackageBars = meanBars(perPackageRows);
  const path = scenarioPath(section, selected.variation);

  return {
    status: "ok",
    report: {
      section: { id: section, label: def.label, about: def.about },
      scenario: {
        variation: selected.variation,
        kind: selected.kind,
        uncurated: selected.uncurated,
        description:
          DESCRIPTIONS[selected.variation] ??
          "This scenario is published but has no description yet.",
        state: selected.state,
        stateParts: selected.kind === "other" ? null : stateParts(selected.state),
        averageOf:
          averageOf === null
            ? null
            : {
                scenarios: averageOf.filter((v) => Object.values(shownPlan).flat().includes(v)),
                byFixture: shownPlan,
              },
      },
      run: { date, latest: index.latest, isLatest: date === index.latest, dates: index.dates },
      path,
      filters: {
        date: pinned,
        fixture,
        range: query.range,
        window: { from: window.from, to: window.to, custom: window.custom },
        hide: hidden,
        metric: query.metric,
        exclude,
        y: query.y,
      },
      isScript,
      measure,
      publishedFixtures,
      fixtures,
      tools,
      ranked,
      unranked: facts.unranked,
      baseline,
      finding,
      stats,
      means,
      leaderboard,
      timeRows,
      perPackageRows,
      timeBars,
      perPackageBars,
      packageCounts: countRows(
        data.bundles.map((b) => ({ fixture: b.fixture, counts: b.counts })),
        tools,
      ),
      processCounts: countRows(
        data.bundles.map((b) => ({ fixture: b.fixture, counts: b.processes })),
        tools,
      ),
      outline,
      trend: {
        points: data.trend,
        rows: dense.rows,
        plotted,
        perPackage: perPackageTrend,
        perPackageByFixture: perPackageTrends,
        endsHere,
        versions: hasVersions ? versionSeries : [],
        markers,
        outliers,
        cut:
          trendDates.length < window.dates.length
            ? `Each run here averages ${filesPerRun} result files, so the trend shows ${trendDates.length} of the window's ${window.dates.length} runs.`
            : null,
        focus,
        inFocus,
      },
      caveats: {
        qualifier: finding.qualifierMarked,
        leaderboard: [
          ...(partial.length === 0
            ? []
            : [
                {
                  title: `${names(partial, section)} did not complete every fixture`,
                  body: `Runs that exited non-zero are excluded from the figures rather than averaged in as fast results — so ${partial.length === 1 ? "its mean covers" : "their means cover"} fewer fixtures than the rest and ${partial.length === 1 ? "is" : "are"} not strictly comparable with them.`,
                },
              ]),
          ...(facts.unranked.length === 0
            ? []
            : [
                {
                  title: `${names(facts.unranked, section)} completed no fixture`,
                  body:
                    facts.unranked.length === 1
                      ? "It ran, but with no completed run it has no mean and is not ranked."
                      : "They ran, but with no completed run they have no mean and are not ranked.",
                },
              ]),
        ],
        timeBars: partialNotes(timeBars.partial, section),
        perPackageBars: partialNotes(perPackageBars.partial, section),
        hidden:
          hidden.length === 0
            ? null
            : {
                title: `${hidden.length} of ${ranked.length} tools hidden`,
                body: `${names(hidden, section)}. The headline and the figures under it are about the ${ranked.length - hidden.length} shown; each row's rank and every “fastest” mark in the tables are still computed over all ${ranked.length}${baselineName === null ? "" : `, and every ratio is still against ${baselineName}`}.`,
              },
        disclosure: tools.includes("vlt")
          ? `vlt publishes this benchmark, and ${section === "registries" ? "registry.vlt.io is one of the registries" : "vlt is one of the tools"} it measures. The suite, its configuration and every result file are public.`
          : null,
      },
      raw:
        average === null
          ? data.bundles.map((b) => ({
              fixture: b.fixture,
              scenario: selected.variation,
              label: fixtureLabel(b.fixture),
              href: client.url(date, benchmarkFile(b.fixture as Fixture, selected.variation)),
            }))
          : average.cells.map((c) => ({
              fixture: c.fixture,
              scenario: c.variation,
              label: `${fixtureLabel(c.fixture)} · ${c.variation}`,
              href: client.url(date, benchmarkFile(c.fixture as Fixture, c.variation)),
            })),
      citation: {
        ...citeFor({ benchmark: def.label, scenario: selected.variation, date }),
        path: reportHref(path, { ...query, date }),
      },
    },
  };
};

/**
 * What a strict reader -- the API, the MCP tools -- refuses rather than
 * silently falling back from, as the page does for a stale link.
 */
export const ignoredSelection = (query: ReportQuery, report: ReportModel): string | null => {
  if (query.date !== null && report.filters.date === null) {
    return `No run was published on ${query.date}.`;
  }
  if (query.fixture !== null && report.filters.fixture === null) {
    return `The ${report.scenario.variation} scenario published no "${query.fixture}" fixture on ${report.run.date}. Fixtures: ${report.publishedFixtures.join(", ")}.`;
  }
  return null;
};
