/**
 * The three top-level sections, and which published variations belong to each.
 *
 * Parity target: `tmp/app/src/routes.tsx` routes
 * `/{section}/:variation[/:subsection[/:fixture]]` for exactly these three, so
 * the redesign preserves the deep-link shape rather than only the tab strip.
 */

/** In the order they are listed everywhere: the header, the landing page. Registries lead. */
export const SECTIONS = ["registries", "package-managers", "task-runners"] as const;
export type SectionId = (typeof SECTIONS)[number];

export interface SectionDef {
  readonly id: SectionId;
  readonly label: string;
  readonly eyebrow: string;
  /** What the benchmark holds constant and what it varies. Method, not results. */
  readonly about: string;
  /**
   * Curated scenario order, from iteration 6a for `package-managers` and from
   * `tmp/app`'s `getVariationCategories` for the other two.
   *
   * Order only. Membership always comes from the manifest, and anything
   * published but missing from this list is surfaced rather than dropped.
   */
  readonly order: readonly string[];
}

export const SECTION_DEFS: { readonly [S in SectionId]: SectionDef } = {
  "package-managers": {
    id: "package-managers",
    label: "Package managers",
    eyebrow: "Package managers · install performance",
    about:
      "The same projects installed by each package manager, from every combination of warm and cold cache, lockfile and node_modules.",
    order: [
      "clean",
      "cache",
      "lockfile",
      "node_modules",
      "cache+lockfile",
      "cache+node_modules",
      "lockfile+node_modules",
      "cache+lockfile+node_modules",
      "ci",
    ],
  },
  registries: {
    id: "registries",
    label: "Registries",
    eyebrow: "Registries · install performance",
    about:
      "The same projects installed with the same npm client from each registry, so the registry is the only thing that changes.",
    order: ["registry-clean", "registry-lockfile"],
  },
  "task-runners": {
    id: "task-runners",
    label: "Task runners",
    eyebrow: "Task runners · script execution",
    about:
      "The same build and the same script started by each runner, measuring what the runner adds.",
    order: ["build", "build-cache", "run"],
  },
};

/**
 * Which section a published variation belongs to.
 *
 * A rule rather than a lookup table, deliberately. `ci+setup` is published
 * upstream and absent from every curated list in this repository; a rule files
 * it under `package-managers` the day it appears, where a table would need
 * editing first.
 */
export const sectionOf = (variation: string): SectionId => {
  if (variation.startsWith("registry-")) return "registries";
  if (variation === "build" || variation === "build-cache" || variation === "run") {
    return "task-runners";
  }
  return "package-managers";
};

export const isSectionId = (value: unknown): value is SectionId =>
  typeof value === "string" && (SECTIONS as readonly string[]).includes(value);
