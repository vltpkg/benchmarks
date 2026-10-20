/**
 * The sidebar's tree, in the shape of fumadocs' `PageTree` (fumadocs-core/
 * page-tree), so the docs' AppSidebar and search run on it unchanged. The
 * docs build theirs from MDX files; this site builds its own from what one
 * date published.
 *
 *   root      the Methodology page, then one folder per benchmark, in
 *             `SECTIONS` order
 *   folder    its index is the section's own page, `/{section}`, named for the
 *             benchmark; then the derived "average" view, then its scenarios, in
 *             curated order, package managers' in Cold / Warm / CI folders,
 *             which the docs' sidebar draws as collapsible sections
 */
import { situationOf, withAverage, type Scenario } from "./scenarios.ts";
import { SECTION_DEFS, SECTIONS, type SectionId } from "./sections.ts";

export interface Item {
  readonly type: "page";
  readonly $id?: string;
  readonly name: string;
  readonly url: string;
}

export interface Separator {
  readonly type: "separator";
  readonly $id?: string;
  readonly name: string;
}

export interface Folder {
  readonly type: "folder";
  readonly $id?: string;
  readonly name: string;
  readonly index?: Item;
  readonly children: Node[];
}

export type Node = Item | Separator | Folder;

export interface Root {
  readonly name: string;
  readonly children: Node[];
}

/** Each section's scenarios on one date. */
export type SectionScenarios = {
  readonly [S in SectionId]: readonly Scenario[];
};

/* Paths are left unencoded: `+` is literal in a path, and `usePathname` reports it so. */
export const treeFor = (scenarios: SectionScenarios): Root => ({
  name: "Benchmarks",
  children: [
    {
      type: "page",
      $id: "about",
      name: "About",
      url: "/about",
    },
    {
      type: "page",
      $id: "methodology",
      name: "Methodology",
      url: "/methodology",
    },
    ...SECTIONS.map((section): Folder => {
      const children: Node[] = [];
      for (const s of withAverage(scenarios[section])) {
        const page: Item = {
          type: "page",
          $id: `${section}/${s.variation}`,
          name: s.variation,
          url: `/${section}/${s.variation}`,
        };
        const situation = situationOf(s);
        if (situation === null) {
          children.push(page);
          continue;
        }
        const last = children.at(-1);
        if (last?.type === "folder" && last.name === situation) last.children.push(page);
        else {
          children.push({
            type: "folder",
            $id: `${section}:${situation}`,
            name: situation,
            children: [page],
          });
        }
      }
      return {
        type: "folder",
        $id: section,
        name: SECTION_DEFS[section].label,
        index: {
          type: "page",
          $id: `${section}/`,
          name: SECTION_DEFS[section].label,
          url: `/${section}`,
        },
        children,
      };
    }),
  ],
});
