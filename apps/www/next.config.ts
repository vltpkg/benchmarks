import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

/**
 * The workspace root, two levels up from `apps/www`.
 *
 * Turbopack otherwise infers its filesystem root as this app's own directory
 * and refuses to compile anything above it. vlt installs into a content-
 * addressed store at the workspace root and links into each member, so `next`
 * itself resolves through `apps/www/node_modules/next` to
 * `<root>/node_modules/.vlt/...`. Without this the build fails with
 * "Could not find the Next.js package".
 */
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const acceptsMarkdown = {
  type: "header",
  key: "accept",
  value: ".*text/markdown.*",
} as const;

/*
 * Extensionless pages, as the docs site has them. Skips the markdown route
 * itself, the API, MCP and social-card endpoints, Next's own assets, and anything with a
 * file extension (`.md` urls, llms.txt, openapi.json), which has no markdown
 * twin.
 */
const pages = "/:path((?!llms\\.mdx/|(?:api|_next|mcp|og)(?:/|$))(?!.*\\.[a-z0-9]+$).+)";

const nextConfig: NextConfig = {
  // Pages prerender a shell around cached data (lib/data.ts), and links prefetch that shell.
  cacheComponents: true,
  partialPrefetching: true,
  // The About and Methodology pages are MDX (app/*/content.mdx).
  pageExtensions: ["ts", "tsx", "mdx"],
  // Both workspace packages ship TypeScript source with no build step, so Next
  // has to transpile them itself. Without this the build fails resolving
  // `@benchmarks/data`'s `.ts` relative imports.
  transpilePackages: ["@benchmarks/types", "@benchmarks/data"],
  // takumi's native renderer (app/og) is loaded by Node, not bundled -- as vlt.io has it.
  serverExternalPackages: ["@takumi-rs/image-response"],
  turbopack: { root: workspaceRoot },
  // The docs' rewrites (vltpkg/www/docs/next.config.ts). The query survives a
  // rewrite, so `/x.md?fixture=astro` is the markdown of that filtered view.
  rewrites: async () => ({
    // Agents that ask for markdown get it at the page's own url; runs before
    // the filesystem, which would otherwise match the html page first.
    beforeFiles: [
      { source: "/", has: [acceptsMarkdown], destination: "/llms.mdx" },
      { source: pages, has: [acceptsMarkdown], destination: "/llms.mdx/:path" },
    ],
    // `/package-managers/clean.md` serves that page as plain markdown.
    afterFiles: [{ source: "/:path+.md", destination: "/llms.mdx/:path+" }],
  }),
  // Those urls answer with html or markdown depending on `Accept`, so caches must key on it.
  headers: async () =>
    ["/", pages].map((source) => ({
      source,
      headers: [{ key: "Vary", value: "Accept" }],
    })),
  // Compare was removed; its links land on the same section's report.
  redirects: async () => [
    /* The front door is the default benchmark; what used to be here is /about.
       Temporary, so the default can change without browsers caching it. */
    { source: "/", destination: "/registries/average", permanent: false },
    /* A benchmark opens on its average, query kept; temporary for the same reason. */
    {
      source: "/:section(registries|package-managers|task-runners)",
      destination: "/:section/average",
      permanent: false,
    },
    { source: "/compare", destination: "/package-managers", permanent: true },
    { source: "/compare/:section/:rest*", destination: "/:section", permanent: true },
  ],
};

export default createMDX()(nextConfig);
