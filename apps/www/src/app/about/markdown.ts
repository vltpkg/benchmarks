import type { MarkdownArgs } from "@affordances/md/next";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { TWIN_CACHE } from "@/lib/markdown";

/*
 * The About page is cards and links into the site; its twin is the llms.txt
 * index, which says the same in the form agents read: every page as Markdown,
 * how to read the results, and the API and MCP server.
 */
export default async function markdown({ request }: MarkdownArgs<"/about">) {
  return (await llmsTxt(request)).text();
}

export const publicCache = TWIN_CACHE;
