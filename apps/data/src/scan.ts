/** Read directory listings off disk, for the manifest builder to classify. */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DirectoryListing } from "./manifest.ts";

/**
 * List the immediate subdirectories of each root and the files in them.
 *
 * Later roots win on name collisions, so a caller can layer this run's freshly
 * assembled output over a checkout of the published history.
 */
export const scanRoots = (roots: string[]): DirectoryListing[] => {
  const byName = new Map<string, DirectoryListing>();

  for (const root of roots) {
    let names: string[];
    try {
      names = readdirSync(root);
    } catch {
      // A missing root is not an error: the reprocess workflow runs without a
      // freshly assembled tree, and local dev often has only one of the two.
      continue;
    }

    for (const name of names.sort()) {
      const dir = join(root, name);
      let files: string[];
      try {
        if (!statSync(dir).isDirectory()) continue;
        files = readdirSync(dir).sort();
      } catch {
        continue;
      }
      byName.set(name, { name, files });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
};
