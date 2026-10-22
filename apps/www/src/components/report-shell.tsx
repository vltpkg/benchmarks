import Link from "next/link";
import type { ReactNode } from "react";
import { TrendSkeleton } from "@/components/charts-echarts";
import { CopyPage } from "@/components/copy-page";
import { FusedChips } from "@/components/fused-chips";
import { Marked } from "@/components/inline-code";
import { PageRow } from "@/components/page-row";
import { Figure, ReportSection } from "@/components/report";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { AVERAGE, DESCRIPTIONS, scenariosFor, stateParts } from "@/lib/scenarios";
import { SECTION_DEFS, type SectionId } from "@/lib/sections";
import { BASELINE, toolLabel } from "@/lib/tools";

/* The first row: as tall as the sidebar's search button (h-9) and level with it. Wraps on a phone. */
export const TOP = "flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-3";

/* The docs' page title: their typeset h1 (typeset.css), so the page sets `typeset typeset-docs` around it. */
export const TITLE = "min-w-0 [overflow-wrap:anywhere]";

/* The finding: the docs' heading weight and tracking, a step under their hero. */
export const FINDING =
  "max-w-[30ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl";

/* The docs' description line, under an article's h1. */
export const DESCRIPTION = "text-base leading-[1.6] text-pretty text-muted-foreground";

/* Below sm the two menus share the row's width; above it each keeps a fixed width. */
export const MENUS = "flex w-full flex-row items-center gap-2 sm:w-auto";
export const TOOLS_MENU = "min-w-0 flex-1 sm:w-60 sm:flex-none";
export const FIXTURE_MENU = "min-w-0 flex-1 sm:w-40 sm:flex-none";

/** A variation name with a break opportunity after each `+`, so a compound name wraps at its joins. */
const ScenarioName = ({ variation }: { variation: string }) =>
  variation.split("+").map((part, index) => (
    <span key={index}>
      {index === 0 ? null : (
        <>
          +<wbr />
        </>
      )}
      {part}
    </span>
  ));

/** The docs' breadcrumb trail, as their pages set it: Benchmarks / the benchmark / the scenario. */
export const Trail = ({
  label,
  sectionHref,
  page,
}: {
  label: string;
  sectionHref: string;
  /** Absent on the benchmark's own page, where the trail ends at the benchmark. */
  page?: string;
}) => (
  <Breadcrumb className="font-pixel">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/">Benchmarks</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator>/</BreadcrumbSeparator>
      <BreadcrumbItem>
        {page === undefined ? (
          <BreadcrumbPage>{label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={sectionHref}>{label}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {page === undefined ? null : (
        <>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{page}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      )}
    </BreadcrumbList>
  </Breadcrumb>
);

const scenarioOf = (section: SectionId, variation: string | undefined) =>
  variation === AVERAGE
    ? { variation, uncurated: false, kind: "other" as const, state: undefined }
    : variation === undefined
      ? undefined
      : scenariosFor(section, [variation])[0];

/**
 * A loading stand-in for text: the text's own lines, filled, so it wraps as
 * the real text will. The fill is a band down each line's middle, so the
 * lines stay apart.
 */
const GHOST =
  "rounded-[0.4em] bg-[linear-gradient(var(--color-muted),var(--color-muted))] bg-[length:100%_70%] bg-center bg-no-repeat text-transparent box-decoration-clone animate-pulse motion-reduce:animate-none [&_code]:border-transparent [&_code]:bg-transparent";

/**
 * Everything above the finding, from the address alone: the trail, the
 * menus and the selection. It needs no data, so it is
 * drawn at once -- around a skeleton while the report loads, and the same
 * again around the report -- and nothing moves when it arrives.
 */
export const ReportHead = ({
  section,
  variation,
  sectionHref,
  menus,
  chips,
}: {
  section: SectionId;
  /** Absent, or not one of this benchmark's: the trail ends at the benchmark. */
  variation: string | undefined;
  sectionHref: string;
  menus: ReactNode;
  chips?: ReactNode;
}) => {
  const scenario = scenarioOf(section, variation);
  return (
    <>
      {/* The page's first row, level with the sidebar's search: where it is, and what it is narrowed to;
          under it, each other non-default choice, one click from undone. */}
      <PageRow
        className={TOP}
        trail={
          <Trail
            label={SECTION_DEFS[section].label}
            sectionHref={sectionHref}
            page={scenario?.variation}
          />
        }
        menus={menus}
        chips={chips}
      />
    </>
  );
};

/**
 * The scenario's badge, the finding as the page's headline, what was on
 * disk, and the description running straight into the lede. Without `finding` it
 * is its own skeleton -- the static parts drawn, the rest a ghost of the
 * sentence it waits for, so the tags and description do not move on arrival.
 */
export const ReportIntro = ({
  section,
  variation,
  averaged,
  finding,
  lede,
  action,
}: {
  section: SectionId;
  variation: string | undefined;
  /** On the derived view, how many scenarios it is the mean of. */
  averaged?: number;
  /** Names between backticks. Absent while the report loads. */
  finding?: string;
  lede?: ReactNode;
  /** Calls to action under the lede: the way to the trend, and on a past run the way to the latest. */
  action?: ReactNode;
}) => {
  const scenario = scenarioOf(section, variation);
  const tags =
    scenario === undefined
      ? []
      : scenario.state === undefined
        ? ["derived", `mean of ${averaged ?? "…"} scenarios`]
        : scenario.kind === "other"
          ? []
          : stateParts(scenario.state).map((part) => `${part.name} ${part.word}`);
  const baseline = `\`${toolLabel(BASELINE, section)}\``;
  return (
    <>
      {/* Above sm, Copy Page sits beside the headline; below, it follows it. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3">
        {scenario === undefined ? null : (
          /* The scenario, then what it was run on, as one row of the same pills:
             the name on its own, the tags fused into a group beside it. */
          <div className="col-span-2 row-start-1 flex flex-wrap items-center gap-2 self-center sm:col-span-1">
            <p className="inline-flex min-h-6 items-center rounded-full border border-border bg-muted px-2.5 font-mono text-xs text-foreground">
              <ScenarioName variation={scenario.variation} />
            </p>
            {tags.length === 0 ? null : <FusedChips items={tags} />}
          </div>
        )}
        {finding === undefined ? (
          <div aria-hidden className={`col-span-2 row-start-2 sm:col-span-1 ${FINDING}`}>
            <span className={GHOST}>
              <Marked text={`${baseline} is fastest at 0.00s, 0.00× faster than ${baseline}.`} />
            </span>
          </div>
        ) : (
          <h1 className={`col-span-2 row-start-2 sm:col-span-1 ${FINDING}`}>
            <Marked text={finding} />
          </h1>
        )}
        {/* Below sm, under the headline: beside the pills it squeezed long scenario names. */}
        <div className="col-span-2 row-start-3 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-start-2 sm:self-start sm:justify-self-end">
          <CopyPage />
        </div>
      </div>
      {/* What the scenario is, under the headline; then, on its own, what the
          numbers are of: the run, the fixtures, the runners. */}
      {scenario === undefined ? null : (
        <p className={`mt-4 max-w-[65ch] ${DESCRIPTION}`}>
          {DESCRIPTIONS[scenario.variation] ??
            "This scenario is published but has no description yet."}
          {scenario.uncurated ? (
            <span className="text-absent">
              {" "}
              Published in this run, and not yet in any curated ordering.
            </span>
          ) : null}
        </p>
      )}
      <p className={`mt-3 max-w-[65ch] ${DESCRIPTION}`}>
        {lede ?? (
          <span aria-hidden className={GHOST}>
            Mean time across 6 fixtures, from the run of Jan 1, 2026 on GitHub-hosted
            ubuntu-24.04-arm runners.
          </span>
        )}
      </p>
      {action === undefined ? null : <div className="mt-5">{action}</div>}
    </>
  );
};

/**
 * The report while it loads: its head, whole, and the body's shape -- the
 * finding, the four numbers, the leaderboard and the trend -- in skeleton.
 */
export const ReportSkeleton = ({
  section,
  variation,
  sectionHref,
}: {
  section: SectionId;
  variation: string | undefined;
  sectionHref: string;
}) => (
  <>
    <ReportHead
      section={section}
      variation={variation}
      sectionHref={sectionHref}
      menus={
        <div aria-hidden className={MENUS}>
          <Skeleton className={`h-8 ${TOOLS_MENU}`} />
          <Skeleton className={`h-8 ${FIXTURE_MENU}`} />
        </div>
      }
    />
    <ReportIntro section={section} variation={variation} />
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div aria-hidden>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="min-h-44 rounded-2xl" />
          ))}
        </div>
        <ReportSection id="leaderboard">
          <Figure id="leaderboard-table" kind="table" level={2} title="Leaderboard">
            <div className="divide-y">
              <div className="flex h-11 items-center px-4">
                <Skeleton className="h-3 w-32" />
              </div>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex h-13 items-center gap-6 px-4">
                  <Skeleton className="h-4 w-5" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="ml-auto h-4 w-16" />
                  <Skeleton className="h-4 w-24 max-sm:hidden" />
                </div>
              ))}
            </div>
          </Figure>
        </ReportSection>
        <ReportSection
          id="time"
          title={
            section === "task-runners" &&
            (variation === AVERAGE ||
              scenariosFor(section, variation === undefined ? [] : [variation])[0]?.kind ===
                "other")
              ? "Execution time"
              : "Install time"
          }
        >
          <TrendSkeleton />
        </ReportSection>
      </div>
    </div>
  </>
);
