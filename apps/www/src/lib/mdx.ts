/**
 * What the MDX pages (About, Methodology) share outside React: their source,
 * their headings' anchors and outline, and their plain-Markdown twin.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TOCItemType } from "@/components/toc-minimap";

/** A page's `.mdx` source, by its path under `src/`. Read per call, so an edit shows without a restart. */
export const mdxSource = (path: string): string =>
  readFileSync(join(process.cwd(), "src", path), "utf8");

/** A heading's anchor: lowercase words joined by hyphens, so "Set up your agent" is `set-up-your-agent`. */
export const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The h2s and h3s of a Markdown or MDX document, for the TOC minimap, anchored as `Heading` anchors them. */
export const tocOf = (markdown: string): TOCItemType[] =>
  [...markdown.matchAll(/^(#{2,3}) (.+)$/gm)].map(([, hashes = "", title = ""]) => ({
    title,
    url: `#${slug(title)}`,
    depth: hashes.length,
  }));

/**
 * An MDX page as plain Markdown: each `<Component />` on a line of its own is
 * replaced by its Markdown equivalent from `blocks`. A component without one
 * is an error, so a new one cannot silently drop out of the twin.
 */
export const mdxMarkdown = (source: string, blocks: Readonly<Record<string, string>>): string =>
  source.replace(/^<([A-Z]\w*) \/>$/gm, (_, name: string) => {
    const block = blocks[name];
    if (block === undefined) throw new Error(`<${name} /> has no Markdown equivalent`);
    return block;
  });
