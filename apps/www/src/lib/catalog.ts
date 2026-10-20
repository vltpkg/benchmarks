/**
 * What the sidebar knows, fetched once by the root layout: each section's
 * scenarios in the latest run, in curated order, and that run's date, which
 * the sidebar's citation cites when the address pins none.
 *
 * The layout persists across navigations, so the sidebar never remounts; the
 * price is that it describes the LATEST run. A page pinned to an older `date`
 * may publish a different set, and the sidebar still lists the latest's -- the
 * page itself ignores a scenario its own date did not publish, as it ignores
 * any stale link.
 *
 * Cost per full page load: the index and one directory entry. Client
 * navigations do not re-run it.
 */
import type { DataClient, DirectoryEntry } from "@benchmarks/data";
import type { Fixture } from "@benchmarks/types";
import { probe } from "./data.ts";
import { sectionTools } from "./headline.ts";
import { fixturesWith } from "./outline.ts";
import type { SectionScenarios } from "./page-tree.ts";
import { DESCRIPTIONS, scenarioPath, scenariosFor } from "./scenarios.ts";
import { SECTION_DEFS, SECTIONS } from "./sections.ts";
import { fixtureLabel, toolLabel } from "./tools.ts";

/** Every variation a directory published, across all fixtures. */
export const publishedVariations = (entry: DirectoryEntry): string[] => [
  ...new Set(Object.values(entry.benchmarks).flatMap((v) => v ?? [])),
];

export const loadCatalog = async (
  client: DataClient,
): Promise<{
  readonly scenarios: SectionScenarios;
  readonly latest: string | null;
  /** The suite commit the latest run was made from, or `null` where the run did not record one. */
  readonly commit: string | null;
}> => {
  const index = await client.getIndex();
  const [entry, chart] =
    index.latest === null
      ? [null, null]
      : await Promise.all([
          client.getDirectoryEntry(index.latest),
          /* The one field read from chart-data.json: the run's own record of the
             commit it ran (from 2026-03-11 on). Nothing else there is used. */
          probe(() => client.getChartData(index.latest as string)),
        ]);
  const published = entry === null ? [] : publishedVariations(entry);
  const sha = chart?.state === "present" ? chart.value.commitSha : undefined;
  return {
    latest: index.latest,
    commit: typeof sha === "string" && /^[0-9a-f]{7,40}$/.test(sha) ? sha : null,
    scenarios: {
      registries: scenariosFor("registries", published),
      "package-managers": scenariosFor("package-managers", published),
      "task-runners": scenariosFor("task-runners", published),
    },
  };
};

/**
 * The catalog for the API and MCP: each section's scenarios in the latest run,
 * and the tools and fixtures its files contain. Costs one fetch per benchmark
 * file of that run.
 */
export const describeCatalog = async (client: DataClient) => {
  const index = await client.getIndex();
  const latest = index.latest;
  if (latest === null) return { latest, sections: [] };
  const entry = await client.getDirectoryEntry(latest);
  const published = publishedVariations(entry);
  const sections = await Promise.all(
    SECTIONS.map(async (section) => {
      const scenarios = scenariosFor(section, published).map((s) => ({
        ...s,
        fixtures: fixturesWith(entry.benchmarks, s.variation),
      }));
      const files = await Promise.all(
        scenarios.flatMap((s) =>
          s.fixtures.map((f) =>
            probe(() => client.getBenchmark(latest, f as Fixture, s.variation)),
          ),
        ),
      );
      const tools = sectionTools(
        section,
        files.flatMap((f) => (f.state === "present" ? [{ file: f.value }] : [])),
      );
      return {
        id: section,
        label: SECTION_DEFS[section].label,
        about: SECTION_DEFS[section].about,
        tools: tools.map((tool) => ({ key: tool, label: toolLabel(tool, section) })),
        fixtures: [...new Set(scenarios.flatMap((s) => s.fixtures))]
          .sort()
          .map((key) => ({ key, label: fixtureLabel(key) })),
        scenarios: scenarios.map((s) => ({
          variation: s.variation,
          path: scenarioPath(section, s.variation),
          description: DESCRIPTIONS[s.variation] ?? null,
          kind: s.kind,
          state: s.kind === "other" ? null : s.state,
          uncurated: s.uncurated,
          fixtures: s.fixtures,
        })),
      };
    }),
  );
  return { latest, sections };
};

export type Catalog = Awaited<ReturnType<typeof describeCatalog>>;
