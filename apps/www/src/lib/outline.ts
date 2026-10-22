/**
 * The results outline for one scenario: which sections exist, and what is in
 * each.
 *
 * Which sections exist is derived from the manifest, not fixed. `build`,
 * `build-cache` and `run` publish neither a package-count nor a process-count
 * file, and every `registry-*` variation publishes no process-count — so a
 * fixed four-section outline would show two empty footprint sections for a
 * third of the scenarios on the site.
 */

export type OutlineItemKind = "chart" | "table";

export interface OutlineItem {
  readonly id: string;
  readonly label: string;
  readonly kind: OutlineItemKind;
}

export interface OutlineSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly OutlineItem[];
}

export interface OutlineInput {
  /** Fixtures with a benchmark file for this variation. */
  readonly fixtures: readonly string[];
  /** Fixtures with a package-count file for this variation. */
  readonly packageCountFixtures: readonly string[];
  /** Fixtures with a process-count file for this variation. */
  readonly processCountFixtures: readonly string[];
  readonly isScript: boolean;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const buildOutline = (input: OutlineInput): OutlineSection[] => {
  const sections: OutlineSection[] = [];
  const chart = (id: string, label: string): OutlineItem => ({ id, label, kind: "chart" });
  const table = (id: string, label: string): OutlineItem => ({ id, label, kind: "table" });

  const fixtureCount = input.fixtures.length;
  if (fixtureCount === 0) return sections;

  const measure = input.isScript ? "Execution time" : "Install time";
  const measureNoun = input.isScript ? "execution" : "install";

  sections.push({
    id: "leaderboard",
    title: "Leaderboard",
    summary: `Ranked by mean across ${plural(fixtureCount, "fixture", "fixtures")}`,
    items: [table("leaderboard-table", "Leaderboard")],
  });

  sections.push({
    id: "time",
    title: measure,
    summary: `By tool, over time, and as raw numbers`,
    items: [
      chart("time-trend", "Performance over time"),
      chart("trend-by-tool", "Trend by tool"),
      chart("time-bars", `Total ${measureNoun} time by tool`),
      ...(fixtureCount > 1
        ? [chart("time-by-fixture", `Total ${measureNoun} time by fixture`)]
        : []),
      table("time-table", `Total ${measureNoun} time`),
    ],
  });

  if (input.packageCountFixtures.length > 0) {
    sections.push({
      id: "per-package",
      title: "Per-package install time",
      summary: "Time normalised by the number of packages each tool installed",
      items: [
        chart("per-package-chart", "Per-package time by tool"),
        ...(input.packageCountFixtures.length > 1
          ? [chart("per-package-by-fixture", "Per-package time by fixture")]
          : []),
        table("per-package-table", "Per-package install time"),
      ],
    });
  }

  const footprint: OutlineItem[] = [];
  if (input.packageCountFixtures.length > 0) {
    footprint.push(table("package-count", "Package count"));
  }
  if (input.processCountFixtures.length > 0) {
    footprint.push(table("process-count", "Spawned processes"));
  }
  if (footprint.length > 0) {
    sections.push({
      id: "footprint",
      title: "Install footprint",
      summary: "What each tool actually put on disk, and how it got there",
      items: footprint,
    });
  }

  return sections;
};

/** Fixtures that published a given variation, from a manifest entry's map. */
export const fixturesWith = (
  byFixture: { readonly [fixture: string]: readonly string[] | undefined },
  variation: string,
): string[] =>
  Object.entries(byFixture)
    .filter(([, variations]) => (variations ?? []).includes(variation))
    .map(([fixture]) => fixture)
    .sort();
