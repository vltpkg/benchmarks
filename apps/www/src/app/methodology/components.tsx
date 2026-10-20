import Link from "next/link";
import { Heading } from "@/components/heading";
import { InlineCode, Marked } from "@/components/inline-code";
import type { SectionScenarios } from "@/lib/page-tree";
import { METHOD, READING, RESOURCES, RUNNER, RUNNER_NOTE, TRADEMARK } from "@/lib/metadata";
import { DESCRIPTIONS, scenarioPath, stateParts } from "@/lib/scenarios";
import { SECTION_DEFS, SECTIONS } from "@/lib/sections";

/*
 * The Methodology page's blocks, as content.mdx places them. The wording is the
 * fact-checked constants in lib/metadata.ts, which the report and llms.txt
 * twins share; each block's Markdown is in ./markdown.ts.
 */

export const Method = () => <p>{METHOD}</p>;

export const Environment = () => (
  <>
    <dl className="not-typeset mt-4 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {RUNNER.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0">
            <InlineCode size="text">{value}</InlineCode>
          </dd>
        </div>
      ))}
    </dl>
    <p className="text-sm text-muted-foreground">{RUNNER_NOTE}</p>
  </>
);

export const Reading = () => (
  <ul>
    {READING.map((line) => (
      <li key={line}>
        <Marked text={line} />
      </li>
    ))}
  </ul>
);

/** Each published scenario, by benchmark, with what was on disk before it ran. */
export const Scenarios = ({ scenarios }: { scenarios: SectionScenarios }) =>
  SECTIONS.map((section) => {
    const label = SECTION_DEFS[section].label;
    return (
      <section key={section} aria-label={label}>
        <Heading as="h3">{label}</Heading>
        <p className="text-muted-foreground">{SECTION_DEFS[section].about}</p>
        <dl>
          {scenarios[section].map((s) => (
            <div key={s.variation}>
              <dt>
                <Link href={scenarioPath(section, s.variation)} className="font-mono">
                  {s.variation}
                </Link>
              </dt>
              <dd>
                {DESCRIPTIONS[s.variation] ?? "Published, with no description yet."}
                {s.kind === "other" ? null : (
                  <ul className="not-typeset mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
                    {stateParts(s.state).map((part) => (
                      <li
                        key={part.name}
                        className="inline-flex h-6 items-center rounded-md bg-muted px-2"
                      >
                        {part.name} {part.word}
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  });

export const Resources = () => (
  <ul>
    {RESOURCES.map(([term, name, href]) => (
      <li key={href}>
        {term}:{" "}
        <a href={href} target="_blank" rel="noopener noreferrer">
          {name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </li>
    ))}
  </ul>
);

export const Trademark = () => <p className="text-xs text-muted-foreground">{TRADEMARK}</p>;
