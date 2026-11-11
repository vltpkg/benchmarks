import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import { withMd } from "@affordances/md/next";
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

/*
 * Every page's Markdown twin (`/x.md`, or the page's url with `Accept:
 * text/markdown`) is @affordances/md's: its rewrites send both to
 * app/api/affordances/md, which converts the page's own HTML, query and
 * redirects included, and fills the figures' `<AgentSlot>`s from each route's
 * markdown.ts.
 */
export default withMd(createMDX()(nextConfig));
