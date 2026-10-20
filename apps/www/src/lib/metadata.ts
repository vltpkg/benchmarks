/**
 * Page metadata, made one way for every page -- the vlt docs site's pattern
 * (vltpkg/www/docs/src/app/layout.tsx): the root layout owns the site name and
 * the title template, and a page supplies only its own name. So
 * `/package-managers/clean` is titled "Package managers — vlt benchmarks", the
 * About page "About — vlt benchmarks"; `/` redirects to the default benchmark.
 *
 * Descriptions say nothing a run could falsify: no tool or fixture counts (they
 * come from data), and the cadence is nightly.
 */
import type { Metadata } from "next";

export const SITE_NAME = "vlt benchmarks";

/** What the site measures, in a line: the site's social card leads with it. */
export const SITE_TAGLINE =
  "Install and run performance for JavaScript package managers, registries and task runners";

export const SITE_DESCRIPTION = `${SITE_TAGLINE}, measured nightly on identical GitHub-hosted runners and published in full.`;

const https = (host?: string) => (host ? `https://${host}` : undefined);

/**
 * Where the site is served; canonical, Open Graph and social-card URLs
 * resolve against it. The deployment's own origin, as the vlt docs work it
 * out (vltpkg/www/docs/src/lib/site-url.ts, after Next's own social-image
 * fallback): localhost in development, so a card previews on the machine
 * serving it; the preview URL on a Vercel preview; the project's production
 * domain in production, and benchmarks.vlt.sh where nothing says otherwise.
 * SITE_URL overrides all of it.
 */
export const siteUrl = new URL(
  process.env.SITE_URL ??
    (process.env.NODE_ENV === "development"
      ? `http://localhost:${process.env.PORT ?? 3000}`
      : process.env.VERCEL_ENV === "preview"
        ? https(process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL)
        : https(process.env.VERCEL_PROJECT_PRODUCTION_URL)) ??
    "https://benchmarks.vlt.sh",
);

/**
 * The origin absolute links are written against. In development, without a
 * SITE_URL, the request's own, so links resolve on the machine serving them.
 */
export const siteOrigin = (request?: Request): string =>
  request !== undefined &&
  process.env.SITE_URL === undefined &&
  process.env.NODE_ENV === "development"
    ? new URL(request.url).origin
    : siteUrl.origin;

/** The social card at `url` (`app/og`), as Open Graph and Twitter both take it. */
const ogImage = (url: string, alt: string) => ({ url, width: 1200, height: 630, alt });

/** The root layout's metadata: the site name, the title template, the icons Next finds in `app/`. */
export const rootMetadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", images: [ogImage("/og", SITE_NAME)] },
  twitter: { card: "summary_large_image", images: [ogImage("/og", SITE_NAME)] },
};

/**
 * A page's metadata: its own title (the template adds the site name), description, path and
 * social card. Without `image` the card is the site's own (`/og`).
 */
export const pageMetadata = ({
  title,
  description = SITE_DESCRIPTION,
  path,
  image = "/og",
}: {
  title: string;
  description?: string;
  path: string;
  image?: string;
}): Metadata => {
  const card = ogImage(image, `${title} — ${SITE_NAME}`);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} — ${SITE_NAME}`, description, url: path, images: [card] },
    twitter: { card: "summary_large_image", images: [card] },
  };
};

/*
 * The Methodology page's Method, Environment and trademark notice, shared
 * with the Markdown twins so they say it in the same words. Fact-checked: see
 * components/site-footer.tsx before rewording any of it.
 */
export const METHOD =
  "Each tool is configured to behave as much like its peers as possible, but standardisation has limits — tools differ in what they install by default, and in which security checks and validations they run. So the suite counts the packages each tool actually installed, after installation, and publishes both figures: total install time, and time per package. A tool that installs fewer packages finishes sooner without necessarily being faster, which is why neither number is reported alone.";

export const RUNNER = [
  ["Workflow label", "ubuntu-24.04-arm"],
  ["VM", "Linux (Ubuntu 24.04)"],
  ["Architecture", "arm64"],
  ["Processor (CPU)", "4 cores"],
  ["Memory (RAM)", "16 GB"],
  ["Storage (SSD)", "14 GB"],
] as const;

/* What it is, what the link is called, where it goes. */
export const RESOURCES = [
  ["Source code", "vltpkg/benchmarks", "https://github.com/vltpkg/benchmarks"],
  [
    "Methodology",
    "METHODOLOGY.md",
    "https://github.com/vltpkg/benchmarks/blob/main/docs/METHODOLOGY.md",
  ],
  [
    "Methodology slides",
    "Google Slides",
    "https://docs.google.com/presentation/d/1ojXF4jb_1MyGhew2LCbdrZ4e_0vYUr-7CoMJLJsHwZY/edit?usp=sharing",
  ],
  [
    "Runner specification",
    "GitHub Docs",
    "https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories",
  ],
] as const;

export const RUNNER_NOTE =
  "The label is read from the workflow. The remaining figures are GitHub's published specification for standard public runners, not measurements taken here.";

export const TRADEMARK =
  "All trademarks, logos and brand names are the property of their respective owners. All company, product and service names used on this site are for identification purposes only. Use of these names, trademarks and brands does not imply endorsement.";

/** How to read a result, as llms.txt states it; names between backticks. */
export const READING = [
  "Total time is the measurement and the ranking: the mean wall-clock install (or, for task runners, execution) time, over the fixtures a tool completed. Lower is faster.",
  "DNF: the run exited non-zero. It is excluded from every mean, chart and ranking, never counted as a time, and reported as DNF.",
  "Partial: a tool that did not complete every fixture. Its mean covers fewer fixtures (shown as n/N), so it is not ranked against tools that did, and it gets no bar.",
  "±RSD: the pooled relative standard deviation across a tool's repeated runs.",
  'Derived metrics are computed from total time and labelled "derived": time per installed package, change since the start of the window, and time relative to the baseline.',
  "The baseline is npm: the npm client for package managers, registry.npmjs.org for registries, `npm run` for task runners. It is a reference point, not the tool to beat.",
  "Results regenerate nightly. A run is named and cited by its date; `?date=YYYY-MM-DD` pins one.",
] as const;
