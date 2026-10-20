/**
 * What a tool key is called on screen, and which one a section measures
 * against.
 *
 * The published files key every result by a short name (`npm`, `berry`,
 * `aws`). The names below are the previous app's (`tmp/app/src/lib/utils.ts`,
 * `getPackageManagerDisplayName`), so a reader coming from it finds the same
 * words. A key with no entry is shown as published rather than guessed at --
 * tools are discovered from the data, and a new one must not need this file
 * edited before it can appear.
 */
import type { SectionId } from "./sections.ts";

const NAMES: { readonly [tool: string]: string } = {
  berry: "yarn (berry)",
  zpm: "yarn (zpm)",
  turbo: "turborepo",
  vp: "vite+",
};

/**
 * In `registry-*` variations the key names a REGISTRY, not a client: `npm` is
 * registry.npmjs.org and `vlt` is registry.vlt.io, both installed with the
 * same npm client. Showing `npm` there would read as the package manager.
 */
const REGISTRIES: { readonly [tool: string]: string } = {
  npm: "registry.npmjs.org",
  vlt: "registry.vlt.io",
  aws: "AWS CodeArtifact",
  cloudsmith: "Cloudsmith",
  github: "GitHub Packages",
  jfrog: "JFrog Artifactory",
};

export const toolLabel = (tool: string, section: SectionId): string =>
  (section === "registries" ? REGISTRIES[tool] : NAMES[tool]) ?? tool;

/**
 * The key every section's ratios are taken against.
 *
 * One key, three meanings, all of them the incumbent default: the npm client
 * for package managers, registry.npmjs.org for registries, and `npm run` for
 * task runners. It is a reference point, not a claim that npm is the tool to
 * beat -- and it is returned as `null` when the data being shown does not
 * contain it, so nothing downstream can divide by a baseline that is absent.
 */
export const BASELINE = "npm";

export const baselineOf = (tools: readonly string[]): string | null =>
  tools.includes(BASELINE) ? BASELINE : null;

/** Fixture names as the previous app printed them; unknown ones pass through. */
const FIXTURE_NAMES: { readonly [fixture: string]: string } = {
  astro: "Astro",
  babylon: "Babylon.js",
  large: "Large",
  next: "Next.js",
  run: "Run",
  svelte: "Svelte",
  vue: "Vue",
};

export const fixtureLabel = (fixture: string): string => FIXTURE_NAMES[fixture] ?? fixture;
