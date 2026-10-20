import {
  ArrowRightIcon,
  BookOpenIcon,
  BracesIcon,
  FileTextIcon,
  PackageIcon,
  PlugIcon,
  ServerIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AgentPrompt } from "@/components/agent-prompt";
import { Blueprint } from "@/components/blueprint";
import { Marked } from "@/components/inline-code";
import { Figure } from "@/components/report";
import { Button } from "@/components/ui/button";
import { ToolName } from "@/components/tool-name";
import { dataClient } from "@/lib/data";
import { toolColor } from "@/lib/chart-model";
import { meanBars, shownBars } from "@/lib/figures";
import { formatDuration, longDate } from "@/lib/findings";
import { scenarioFacts, type ScenarioFacts } from "@/lib/headline";
import { loadScenario } from "@/lib/load";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/metadata";
import { fixturesWith } from "@/lib/outline";
import { scenarioPath, scenariosFor, type Scenario } from "@/lib/scenarios";
import { SECTION_DEFS, SECTIONS, type SectionId } from "@/lib/sections";
import { toolLabel } from "@/lib/tools";

/*
 * The About page's blocks, as content.mdx places them: everything on it that
 * is computed, interactive or drawn. Each is set apart from the article's
 * typography (`data-not-typeset`), as the docs set their embedded components.
 */

interface Headline {
  readonly section: SectionId;
  readonly scenario: Scenario;
  readonly scenarioCount: number;
  readonly fixtureCount: number;
  readonly facts: ScenarioFacts;
}

const SECTION_ICONS: { readonly [S in SectionId]: LucideIcon } = {
  registries: ServerIcon,
  "package-managers": PackageIcon,
  "task-runners": WorkflowIcon,
};

/* A count as a quiet chip: the number in the foreground, its noun muted. */
const Chip = ({ n, one, many }: { n: number; one: string; many: string }) => (
  <li className="inline-flex h-9 items-center gap-1 rounded-xl border bg-(--code-editor-background) px-3 text-xs text-muted-foreground tabular-nums">
    <span className="font-medium text-foreground">{n}</span>
    {n === 1 ? one : many}
  </li>
);

/** The agent prompt, in llms.txt's words (app/llms.txt/route.ts): what to read, the API, the MCP server, how to read a result. */
const agentPrompt = (
  origin: string,
): string => `Help me use the vlt benchmarks. Start by reading ${origin}/llms.txt, which lists every page of the site and explains how to read the results. Every page is available as Markdown: append .md to its URL, or request the page with an Accept: text/markdown header. Query parameters apply to the Markdown as they do to the page: ${origin}/package-managers/clean.md?fixture=babylon is that scenario on one fixture. ${origin}/llms-full.txt holds every scenario of the latest run, at the default view, in one file.

1. For structured data, use the JSON API, described at ${origin}/openapi.json: /api/v1/runs, /api/v1/catalog, /api/v1/{section}/{scenario} (the full report, same parameters as the page) and /api/v1/{section}/{scenario}/history (the trend, failures and coverage).
2. To query it as tools, add the read-only MCP server with \`claude mcp add --transport http vlt-benchmarks ${origin}/mcp\`. Its tools are list_benchmarks, get_results, get_history and compare_scenarios.
3. When you report a result: total time is the measurement and the ranking. A DNF (the run exited non-zero) is never counted as a time, a tool that did not complete every fixture is not ranked against tools that did, and derived metrics are labelled "derived".

Only quote numbers that appear on the site, and name a run by its date.`;

type Card = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Absent for a surface a browser cannot open (the MCP endpoint). */
  href?: string;
};

const cards: Card[] = [
  {
    icon: BookOpenIcon,
    title: "llms.txt",
    description: "An index of every page on this site, for agents to read before anything else.",
    href: "/llms.txt",
  },
  {
    icon: FileTextIcon,
    title: "Markdown pages",
    description:
      "Add .md to any page's URL for a plain Markdown copy, or read every scenario of the latest run in one file.",
    href: "/llms-full.txt",
  },
  {
    icon: BracesIcon,
    title: "JSON API",
    description:
      "Runs, the catalog, and each scenario's full report and history, described by an OpenAPI document.",
    href: "/openapi.json",
  },
  {
    icon: PlugIcon,
    title: "MCP server",
    description:
      "Read-only tools at /mcp to list benchmarks, get results and history, and compare scenarios.",
  },
];

/* The docs' card grid (vltpkg/www/docs/src/app/page.tsx), verbatim but for the card without a link. */
const CardGrid = ({ cards }: { cards: Card[] }) => (
  <ul className="mt-6 grid gap-4 md:grid-cols-3">
    {cards.map(({ icon: Icon, title, description, href }) => {
      const body = (
        <>
          <Icon aria-hidden className="size-5" />
          <h3 className="mt-6 font-medium">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </>
      );
      return (
        <li key={title}>
          {href === undefined ? (
            <div className="flex h-full flex-col rounded-xl border p-6">{body}</div>
          ) : (
            <a
              href={href}
              className="flex h-full flex-col rounded-xl border p-6 transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
            >
              {body}
            </a>
          )}
        </li>
      );
    })}
  </ul>
);

/* Who publishes the site and what it holds, for agents and search engines (schema.org JSON-LD), in
   the docs' shape. The organisation is the docs' own; the dataset claims nothing a run could falsify. */
const jsonLd = (origin: string, latest: string | null) => {
  const org = {
    "@type": "Organization",
    "@id": "https://www.vlt.io/#organization",
    name: "vlt",
    legalName: "vlt technology inc",
    url: "https://www.vlt.io",
    logo: new URL("/icon1.png", origin).href,
    sameAs: [
      "https://github.com/vltpkg",
      "https://www.linkedin.com/company/vltpkg/",
      "https://x.com/vltpkg",
      "https://bsky.app/profile/vlt.sh",
    ],
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${origin}/`,
        description: SITE_DESCRIPTION,
        publisher: { "@id": org["@id"] },
      },
      {
        "@type": "Dataset",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: `${origin}/`,
        ...(latest === null ? {} : { dateModified: latest }),
        publisher: { "@id": org["@id"] },
        creator: { "@id": org["@id"] },
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `${origin}/api/v1/catalog`,
          },
          {
            "@type": "DataDownload",
            encodingFormat: "text/markdown",
            contentUrl: `${origin}/llms-full.txt`,
          },
        ],
      },
    ],
  };
};

export const JsonLd = async () => {
  const origin = siteOrigin();
  const index = await dataClient().getIndex();
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd(origin, index.latest)).replace(/</g, "\\u003c"),
      }}
    />
  );
};

/* The docs' home page hero (vltpkg/www/docs/src/app/page.tsx): the title, the lede, a way into each benchmark. */
export const Hero = ({ title, lede }: { title: string; lede: string }) => (
  /* the docs' inset is py-8 md:py-12; this one is pt-4 so report pages line up with the sidebar's search */
  <section data-not-typeset className="relative isolate mt-4 md:mt-8">
    {/* Behind the text, larger than the hero and free to overlap it; a fade from the page
        colour keeps the words readable wherever the two meet. Nudged down so it clears the
        header rather than tucking under it. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden items-center lg:flex"
    >
      <Blueprint className="h-80 w-auto translate-x-4 translate-y-10 xl:h-96" />
    </div>
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-3/4 bg-linear-to-r from-background from-55% to-transparent lg:block"
    />
    <div className="max-w-3xl min-w-0">
      <h1 className="text-5xl font-semibold tracking-tighter text-balance sm:text-6xl sm:leading-[1.05]">
        {title}
      </h1>
      <p className="mt-6 text-lg text-pretty text-muted-foreground sm:text-xl">{lede}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {SECTIONS.map((id, i) => (
          <Button
            key={id}
            asChild
            size="lg"
            variant={i === 0 ? "default" : "outline"}
            // the docs' `lg` button is h-9; this app's older shadcn `lg` is h-10
            className="h-9 px-4"
          >
            <Link href={`/${id}`}>{SECTION_DEFS[id].label}</Link>
          </Button>
        ))}
      </div>
    </div>
  </section>
);

/** The agent prompt, with the reader's origin in it, and the ways in it names. */
export const AgentSetup = async () => (
  <div data-not-typeset>
    <div className="mt-6">
      <AgentPrompt prompt={agentPrompt(siteOrigin())} />
    </div>
    <div className="mt-4">
      <CardGrid cards={cards} />
    </div>
  </div>
);

/**
 * What each benchmark found in the latest run.
 *
 * Each finding is the SAME sentence its own page leads with, computed by the
 * same function from the same files (`lib/headline.ts`) for that section's
 * first scenario -- the one `/{section}` opens on -- and links to that
 * scenario's page. So a reader who follows a link lands on the heading they
 * just read, and the two cannot disagree.
 *
 * A section the latest run published nothing for says so. It does not borrow
 * an older run's finding to fill the space.
 */
export const LatestResults = async () => {
  const client = dataClient();
  const index = await client.getIndex();
  const date = index.latest;

  const headlines =
    date === null
      ? []
      : await (async () => {
          const entry = await client.getDirectoryEntry(date);
          const published = [...new Set(Object.values(entry.benchmarks).flatMap((v) => v ?? []))];
          return Promise.all(
            SECTIONS.map(
              async (section): Promise<Headline | { section: SectionId; scenario: null }> => {
                const scenarios = scenariosFor(section, published);
                const scenario = scenarios[0];
                if (scenario === undefined) return { section, scenario: null };
                const fixtures = fixturesWith(entry.benchmarks, scenario.variation);
                const data = await loadScenario(client, date, scenario.variation, fixtures, []);
                return {
                  section,
                  scenario,
                  scenarioCount: scenarios.length,
                  fixtureCount: fixtures.length,
                  facts: scenarioFacts(section, data.bundles),
                };
              },
            ),
          );
        })();

  return (
    <div data-not-typeset>
      <p className="mt-3 max-w-[65ch] text-pretty text-muted-foreground">
        {date === null ? (
          "The served tree reports no dates. There is nothing to show."
        ) : (
          <>
            From the nightly run of <time dateTime={date}>{longDate(date)}</time>. Each finding is
            the headline of its benchmark&apos;s report.
          </>
        )}
      </p>
      <div className="mt-8 space-y-6">
        {headlines.map((h) => {
          const Icon = SECTION_ICONS[h.section];
          const label = SECTION_DEFS[h.section].label;
          return h.scenario === null ? (
            <article
              key={h.section}
              className="rounded-2xl bg-card p-6 shadow-lg ring-1 shadow-black/6.5 ring-border-illustration"
            >
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Icon aria-hidden className="size-4 text-brand" />
                {label}
              </h3>
              <p className="mt-4 max-w-[65ch] text-pretty text-muted-foreground">
                {SECTION_DEFS[h.section].about}
              </p>
              <p className="mt-4 text-absent">
                The run of {longDate(date ?? "")} published nothing for this benchmark.
              </p>
            </article>
          ) : (
            /* The figures' own container: the scenario is the tab, the
                 finding and its ranking the panel, the counts and the way
                 in the footer. */
            <Figure
              key={h.section}
              id={`latest-${h.section}`}
              kind="bar"
              title={h.scenario.variation}
              titlePrefix={`${label}, scenario`}
              tabLead={
                <span className="flex items-center gap-2 font-sans text-sm font-medium text-foreground">
                  {label}
                  <span aria-hidden className="text-muted-foreground/60">
                    /
                  </span>
                </span>
              }
              footer={
                <>
                  <Button asChild variant="outline" className="h-9 rounded-xl">
                    <Link href={`/${h.section}`} aria-label={`${label} benchmark: the full report`}>
                      {label} benchmark
                      <ArrowRightIcon aria-hidden />
                    </Link>
                  </Button>
                  <ul aria-label="Counts" className="ml-auto flex flex-wrap gap-2">
                    <Chip n={h.facts.tools.length} one="tool" many="tools" />
                    <Chip n={h.fixtureCount} one="fixture" many="fixtures" />
                    <Chip n={h.scenarioCount} one="scenario" many="scenarios" />
                  </ul>
                </>
              }
            >
              <div className="@container">
                <div className="grid gap-x-10 gap-y-6 p-5 sm:p-6 @4xl:grid-cols-2">
                  {/* The finding at the top, its notes at the foot, so the column fills
                      the height the ranking beside it takes. */}
                  <div className="flex flex-col gap-4">
                    <p className="max-w-[30ch] text-2xl font-semibold tracking-tight text-balance">
                      <Link
                        href={scenarioPath(h.section, h.scenario.variation)}
                        className="hover:underline hover:decoration-2"
                      >
                        <Marked text={h.facts.finding.marked} />
                      </Link>
                    </p>
                    <div className="mt-auto space-y-2 text-xs leading-relaxed text-pretty text-muted-foreground">
                      {h.facts.finding.qualifierMarked === null ? null : (
                        <p className="max-w-[65ch]">
                          <Marked text={h.facts.finding.qualifierMarked} />
                        </p>
                      )}
                      <RankingNote
                        section={h.section}
                        scenario={h.scenario.variation}
                        facts={h.facts}
                      />
                    </div>
                  </div>
                  <Ranking section={h.section} facts={h.facts} />
                </div>
              </div>
            </Figure>
          );
        })}
      </div>
    </div>
  );
};

/**
 * The ranking in miniature: one horizontal bar per tool, fastest first, in
 * plain HTML. Only a tool that completed every fixture gets a bar (`meanBars`,
 * as the report's bar figure); the rest are named, not drawn.
 */
const Ranking = ({ section, facts }: { section: SectionId; facts: ScenarioFacts }) => {
  const { bars } = meanBars(facts.timeRows);
  const shown = shownBars(bars, facts.baseline);
  const max = Math.max(...shown.map((b) => b.value));
  const name = (tool: string) => toolLabel(tool, section);
  return (
    <div className="flex flex-col justify-center">
      {/* Drawn for the eye; the list below carries the same for assistive technology. */}
      <ol
        aria-hidden
        className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] gap-x-3 gap-y-3 text-sm"
      >
        {shown.map((b) => (
          <li key={b.tool} className="col-span-3 grid grid-cols-subgrid items-center">
            <ToolName tool={b.tool} section={section} />
            {/* Zero-based: a bar's length is the number. The report's stripped bar: a bright
                cap on a dimmed body. The baseline is a dashed outline, as on the report. */}
            <span
              className={`h-3 min-w-0.5 rounded-sm ${b.tool === facts.baseline ? "border-[1.5px] border-dashed" : ""}`}
              style={{
                width: `${(b.value / max) * 100}%`,
                backgroundColor: `color-mix(in oklab, ${toolColor(b.tool)} 22%, transparent)`,
                boxShadow: `inset -3px 0 0 ${toolColor(b.tool)}`,
                ...(b.tool === facts.baseline ? { borderColor: toolColor(b.tool) } : {}),
              }}
            />
            <span className="text-right tabular-nums">
              {formatDuration(b.value)}
              {b.tool === facts.baseline ? (
                <span className="block text-xs leading-tight text-muted-foreground">baseline</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <ol className="sr-only">
        {shown.map((b) => (
          <li key={b.tool}>
            {name(b.tool)}: {formatDuration(b.value)}
            {b.tool === facts.baseline ? ", the baseline" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
};

/* What the ranking leaves out, said beside the finding rather than under the bars. */
const RankingNote = ({
  section,
  scenario,
  facts,
}: {
  section: SectionId;
  scenario: string;
  facts: ScenarioFacts;
}) => {
  const { bars, partial } = meanBars(facts.timeRows);
  const rest = bars.length - shownBars(bars, facts.baseline).length;
  const name = (tool: string) => toolLabel(tool, section);
  return partial.length === 0 && rest === 0 ? null : (
    <p>
      {partial.length === 0
        ? null
        : `Not drawn: ${partial.map(name).join(", ")}, which did not complete every fixture. `}
      {rest === 0 ? null : (
        <>
          And {rest} more in the{" "}
          <Link href={scenarioPath(section, scenario)} className="underline underline-offset-4">
            full ranking
          </Link>
          .
        </>
      )}
    </p>
  );
};
