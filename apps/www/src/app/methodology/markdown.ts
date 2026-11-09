import type { MarkdownArgs } from "@affordances/md/next";
import { loadCatalog } from "@/lib/catalog";
import { dataClient } from "@/lib/data";
import { TWIN_CACHE } from "@/lib/markdown";
import { siteOrigin } from "@/lib/metadata";
import { methodologyMarkdown } from "@/lib/methodology-markdown";

/*
 * The Methodology twin is written, not converted: the page's description
 * lists convert to bold paragraphs, and each scenario's state list runs into
 * its description. This is content.mdx with each block as Markdown, the
 * fact-checked wording word for word.
 */
export default async function markdown({ request }: MarkdownArgs<"/methodology">) {
  const { scenarios } = await loadCatalog(dataClient());
  return methodologyMarkdown(scenarios, siteOrigin(request));
}

export const publicCache = TWIN_CACHE;
