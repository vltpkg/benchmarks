/**
 * Scenarios: the published variations of one section, ordered for display.
 *
 * Two rules meet here and the reconciliation is the point.
 *
 * `tmp/app`'s `getVariationCategories` intersects a hardcoded order with
 * discovered data -- curated order, discovered membership -- which is the right
 * shape and is kept. What is NOT kept is its `.filter()`, which silently drops
 * anything discovered but uncurated. `ci+setup` is published upstream today and
 * would vanish without a trace. Discovered-but-uncurated scenarios are surfaced
 * here instead, flagged, after the curated ones.
 */
import { SECTION_DEFS, sectionOf, type SectionId } from "./sections.ts";

/** The three pieces of machine state a scenario starts from. */
export interface ScenarioState {
  readonly cache: boolean;
  readonly lockfile: boolean;
  readonly nodeModules: boolean;
}

/** How the scenario reads at a glance, as iteration 6a labels the cards. */
export type ScenarioKind = "cold" | "partial" | "warm" | "ci" | "other";

export interface Scenario {
  readonly variation: string;
  readonly state: ScenarioState;
  readonly kind: ScenarioKind;
  /**
   * True when the variation is published but appears in no curated order.
   *
   * Surfaced in the UI rather than hidden: a scenario nobody has described yet
   * is still real data, and silently dropping it is the failure this repository
   * keeps producing.
   */
  readonly uncurated: boolean;
  /**
   * Set only on the derived "average" view: the measured scenarios it is the
   * mean of. Never a measurement of its own.
   */
  readonly averageOf?: readonly string[];
}

/**
 * Read the starting state out of the variation name.
 *
 * The names are compound tokens (`cache+lockfile+node_modules`), so this is
 * parsing what the suite already encodes rather than a second source of truth.
 * `ci` is the one piece of semantics not in the name: an npm-ci-style install
 * requires a lockfile and refuses to run without one.
 */
export const scenarioState = (variation: string): ScenarioState => {
  const parts = variation.split("+");
  const has = (token: string): boolean => parts.includes(token);
  const ci = parts.includes("ci");
  return {
    cache: has("cache"),
    lockfile: has("lockfile") || ci,
    nodeModules: has("node_modules"),
  };
};

export const scenarioKind = (variation: string, state: ScenarioState): ScenarioKind => {
  if (variation.split("+").includes("ci")) return "ci";
  if (variation.startsWith("registry-") || variation.startsWith("build") || variation === "run") {
    return "other";
  }
  const warmth = Number(state.cache) + Number(state.lockfile) + Number(state.nodeModules);
  if (warmth === 0) return "cold";
  if (warmth === 3) return "warm";
  return "partial";
};

/**
 * Build the ordered scenario list for one section from what a date actually
 * published.
 *
 * `published` is the variation list from that date's manifest shard -- never a
 * `chart-data.json` section list. `2026-04-14` advertises both registry
 * sections while holding zero registry files, so a consumer that trusts the
 * chart's own lists renders a confident empty chart on that date.
 */
export const scenariosFor = (section: SectionId, published: readonly string[]): Scenario[] => {
  const mine = [...new Set(published)].filter((v) => sectionOf(v) === section);
  const order = SECTION_DEFS[section].order;

  const build = (variation: string, uncurated: boolean): Scenario => {
    const state = scenarioState(variation);
    return { variation, state, kind: scenarioKind(variation, state), uncurated };
  };

  const curated = order.filter((v) => mine.includes(v)).map((v) => build(v, false));
  const extra = mine
    .filter((v) => !order.includes(v))
    .sort()
    .map((v) => build(v, true));

  return [...curated, ...extra];
};

/** Every variation published for a date that no section's curated order names. */
export const uncuratedOf = (scenarios: readonly Scenario[]): Scenario[] =>
  scenarios.filter((s) => s.uncurated);

/** A scenario's page. */
export const scenarioPath = (section: SectionId, variation: string): string =>
  `/${section}/${encodeURIComponent(variation)}`;

/** The derived view's variation key, and its path segment. */
export const AVERAGE = "average";

/**
 * The scenarios with the derived "average" view first, as `main` listed it,
 * when there are at least two curated ones to average. Curated only: an
 * undescribed scenario (`ci+setup` today) is not folded into a number.
 */
export const withAverage = (scenarios: readonly Scenario[]): Scenario[] => {
  const averageOf = scenarios.filter((s) => !s.uncurated).map((s) => s.variation);
  if (averageOf.length < 2) return [...scenarios];
  const state = { cache: false, lockfile: false, nodeModules: false };
  return [{ variation: AVERAGE, state, kind: "other", uncurated: false, averageOf }, ...scenarios];
};

/**
 * The situation a package-manager scenario models, for the sidebar's
 * sub-labels: a cold first install, a warm reinstall, or CI. Anything
 * uncurated is filed under CI, after the curated ones. `null` where the name
 * encodes no disk state (registries, task runners), which are not grouped.
 */
export const situationOf = (scenario: Scenario): "Cold" | "Warm" | "CI" | null => {
  if (scenario.kind === "other") return null;
  if (scenario.uncurated || scenario.kind === "ci") return "CI";
  return scenario.kind === "cold" ? "Cold" : "Warm";
};

/**
 * What was on disk before each run, in four parts, worded as the scenario
 * picker worded them. Drawn only where the NAME encodes the state
 * (`kind !== "other"`): `registry-lockfile`, `build` and `run` do not, and read
 * the same way would claim an absent lockfile for a lockfile install.
 */
export const stateParts = (
  state: ScenarioState,
): readonly { readonly name: string; readonly present: boolean; readonly word: string }[] => [
  { name: "binary", present: true, word: "preinstalled" },
  { name: "cache", present: state.cache, word: state.cache ? "present" : "empty" },
  { name: "lockfile", present: state.lockfile, word: state.lockfile ? "present" : "absent" },
  {
    name: "node_modules",
    present: state.nodeModules,
    word: state.nodeModules ? "present" : "removed",
  },
];

/**
 * Prose for each scenario.
 *
 * Lifted from `docs/METHODOLOGY.md`'s variations table so there is one
 * description of what a variation does, not two that can drift apart. A
 * scenario with no entry says so rather than guessing.
 */
export const DESCRIPTIONS: { readonly [variation: string]: string } = {
  clean:
    "A first install on a fresh machine. Every package is resolved, downloaded and linked from scratch.",
  cache: "The package cache is warm. Nothing else is: no lockfile, no node_modules.",
  lockfile:
    "A lockfile pins the graph, but nothing is cached and nothing is installed. Resolution is skipped; download is not.",
  node_modules:
    "node_modules is already populated. The question is how quickly a tool can decide there is little to do.",
  "cache+lockfile": "Cache and lockfile both warm. No node_modules to reuse.",
  "cache+node_modules": "Cache and node_modules present, with no lockfile to pin the graph.",
  "lockfile+node_modules": "Lockfile and node_modules present, with a cold cache.",
  "cache+lockfile+node_modules":
    "Everything warm. The best case, and usually dominated by how fast a tool can decide it has nothing to do.",
  ci: "The tool's CI-oriented install — npm ci and its equivalents. Requires a lockfile and installs strictly from it.",
  "registry-clean":
    "A cold install, holding the package manager constant and varying the registry.",
  "registry-lockfile":
    "A lockfile install, holding the package manager constant and varying the registry.",
  build: "A project build after install. Measures the build, not the install.",
  "build-cache": "The same build with a warm build cache.",
  run: "Script execution only: process startup, reading package.json, and spawning the command.",
  [AVERAGE]: "Every tool across all of this benchmark's scenarios at once.",
};
