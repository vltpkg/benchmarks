import type { ComponentProps } from "react";
import { Heading } from "@/components/heading";
import { TOCMinimap } from "@/components/toc-minimap";
import { mdxSource, tocOf } from "@/lib/mdx";
import { pageMetadata, SITE_DESCRIPTION } from "@/lib/metadata";
import { AgentSetup, Hero, JsonLd, LatestResults } from "./components";
import Content from "./content.mdx";

/* The site's front page: what the benchmarks are, how agents read them, and the
   latest headline of each. `/` itself opens on the default benchmark. Its
   Markdown twin is llms.txt. */
export const metadata = pageMetadata({
  title: "About",
  description: SITE_DESCRIPTION,
  path: "/about",
});

/* The landing page's own scale, in the docs' home page's shape rather than an article's. */
const components = {
  h2: ({ ref: _ref, ...props }: ComponentProps<"h2">) => (
    <Heading as="h2" className="mt-24 text-2xl tracking-tight" {...props} />
  ),
  p: ({ ref: _ref, ...props }: ComponentProps<"p">) => (
    <p className="mt-3 max-w-[65ch] text-pretty text-muted-foreground" {...props} />
  ),
  Hero,
  AgentSetup,
  LatestResults,
};

const About = () => (
  <>
    {/* A landing page, not an article: the body's size and leading, and no trim of the hero's top margin. */}
    <article className="typeset typeset-docs text-body leading-normal [margin-trim:none]">
      <JsonLd />
      <Content components={components} />
    </article>
    <TOCMinimap items={tocOf(mdxSource("app/about/content.mdx"))} />
  </>
);

export default About;
