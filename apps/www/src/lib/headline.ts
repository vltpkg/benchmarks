/**
 * Everything a page derives from one scenario's files, in one place.
 *
 * The landing page and the section page both state a headline finding. If
 * each computed its own they could disagree about the same run -- so both get
 * it from here, from the same bundles, by the same rules.
 */
import type { BenchmarkFile } from "@benchmarks/types";
import { findingFor, type Finding } from "./findings.ts";
import type { FixtureBundle } from "./load.ts";
import {
  byFixture,
  meanByTool,
  PACKAGE_MANAGERS,
  unranked,
  type FixtureRow,
  type ToolMean,
} from "./measurements.ts";
import type { SectionId } from "./sections.ts";
import { baselineOf, toolLabel } from "./tools.ts";

export interface ScenarioFacts {
  /** The tools this section compares, as found in the files. */
  readonly tools: readonly string[];
  readonly means: readonly ToolMean[];
  readonly timeRows: readonly FixtureRow[];
  /** `null` when these files do not contain the baseline. */
  readonly baseline: string | null;
  readonly finding: Finding;
  /** Tools that ran and finished nowhere, so cannot be ranked at all. */
  readonly unranked: readonly string[];
}

/* Tool set: the curated eleven for package-managers (parity with
   tmp/app's utils.ts), otherwise whatever the measurements contain. */
export const sectionTools = (
  section: SectionId,
  files: readonly { readonly file: BenchmarkFile }[],
): string[] => {
  const measured = [...new Set(files.flatMap((f) => f.file.results.map((r) => r.command)))];
  return section === "package-managers"
    ? measured.filter((t) => (PACKAGE_MANAGERS as readonly string[]).includes(t))
    : measured;
};

/**
 * The finding over the tools the reader has not hidden, from the same facts
 * and by the same function as the unscoped one; the sentence names what is
 * hidden. With nothing hidden, or everything, it is the unscoped finding.
 */
export const scopedFinding = (
  section: SectionId,
  facts: ScenarioFacts,
  fixtureCount: number,
  where: string | null,
  hidden: readonly string[],
): ScenarioFacts["finding"] =>
  hidden.length === 0 || facts.means.every((m) => hidden.includes(m.tool))
    ? facts.finding
    : findingFor({
        means: facts.means,
        rows: facts.timeRows,
        fixtureCount,
        baseline: facts.baseline,
        label: (tool) => toolLabel(tool, section),
        where,
        hidden,
      });

export const scenarioFacts = (
  section: SectionId,
  bundles: readonly FixtureBundle[],
  /** A phrase naming what `bundles` was narrowed to, e.g. "On Astro". */
  where: string | null = null,
): ScenarioFacts => {
  const tools = sectionTools(section, bundles);

  const means = meanByTool(bundles, tools);
  const timeRows = byFixture(bundles, tools);
  const baseline = baselineOf(means.map((m) => m.tool));

  return {
    tools,
    means,
    timeRows,
    baseline,
    finding: findingFor({
      means,
      rows: timeRows,
      fixtureCount: bundles.length,
      baseline,
      label: (tool) => toolLabel(tool, section),
      where,
    }),
    unranked: unranked(bundles, tools),
  };
};
