/**
 * The Markdown twins' own code (@affordances/md): each route's `markdown.ts`,
 * called as the handler calls it. What the handler does with the page's HTML
 * is checked against a running server by twins.e2e.mjs.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import reportTwin, {
  notFoundMarkdown,
  publicCache,
  slots,
} from "../src/app/[section]/[[...params]]/markdown.ts";
import aboutTwin from "../src/app/about/markdown.ts";
import methodologyTwin from "../src/app/methodology/markdown.ts";
import { GET as llms } from "../src/app/llms.txt/route.ts";
import { figureMarkdown, reportMarkdown, TWIN_CACHE } from "../src/lib/markdown.ts";
import { METHOD, READING, RUNNER_NOTE, TRADEMARK } from "../src/lib/metadata.ts";
import { loadReportParams } from "../src/lib/params.ts";
import { loadReport, type ReportModel } from "../src/lib/report.ts";
import { DATA_URL, fakeFetch } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.vlt.io";

beforeAll(() => {
  vi.stubEnv("DATA_URL", DATA_URL);
  vi.stubGlobal("fetch", fakeFetch);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* `MarkdownArgs` as the handler builds them for a page path: params URI-encoded, the query as given. */
const args = (path: string, search = "") => {
  const [section = "", ...rest] = path.split("/").slice(1).map(encodeURIComponent);
  return {
    route: "/[section]/[[...params]]" as const,
    params: rest.length === 0 ? { section } : { section, params: rest },
    searchParams: new URLSearchParams(search),
    request: new Request(`${ORIGIN}/api/affordances/md${path}${search}`),
  };
};

const reportOf = async (section: string, scenario: string, search = ""): Promise<ReportModel> => {
  const result = await loadReport({
    section,
    scenario,
    query: loadReportParams(new URLSearchParams(search)),
  });
  if (result.status !== "ok") throw new Error(result.status);
  return result.report;
};

const fill = async (name: keyof typeof slots, path: string, search = "") =>
  slots[name](args(path, search));

describe("a report's twin", () => {
  it("is its page: the default leaves a report to the HTML", async () => {
    expect(await reportTwin(args("/package-managers/clean"))).toBeUndefined();
    expect(await reportTwin(args("/package-managers/clean", "?fixture=astro"))).toBeUndefined();
  });

  it("leaves `/{section}` to the page's redirect to its average", async () => {
    expect(await reportTwin(args("/package-managers"))).toBeUndefined();
  });

  it("fills every figure on the page with the numbers the Markdown builder gives it", async () => {
    const report = await reportOf("package-managers", "clean");
    const figures = figureMarkdown(report, ORIGIN);
    const whole = reportMarkdown(report, ORIGIN);
    for (const item of report.outline.flatMap((s) => s.items)) {
      expect(Object.keys(slots)).toContain(item.id);
      const filled = await fill(item.id as keyof typeof slots, "/package-managers/clean");
      expect(filled).toBe(figures[item.id]?.join("\n"));
      // ...the same lines the MCP tools and the API's Markdown carry.
      expect(whole).toContain(filled);
    }
  });

  it("is the filtered view: the query reaches every fill", async () => {
    const context = await fill("context", "/package-managers/clean", "?fixture=astro");
    expect(context).toContain("  - fixture: astro");
    const trend = await fill("time-trend", "/package-managers/clean", "?fixture=astro&range=all");
    expect(trend).toMatch(/^Mean install time in seconds, one row per calendar day from /);
    expect(trend).toContain("```csv\ndate,");
    const astro = await reportOf("package-managers", "clean", "?fixture=astro&range=all");
    expect(trend).toBe(figureMarkdown(astro, ORIGIN)["time-trend"]?.join("\n"));
  });

  it("says what a strict reader is told when the report falls back from a selection", async () => {
    const context = await fill("context", "/package-managers/clean", "?fixture=nope");
    expect(context).toMatch(
      /^> The clean scenario published no "nope" fixture on .+ This is the report without that selection\.\n/,
    );
  });

  it("closes with the caveats, method, data and a citation", async () => {
    const reference = await fill("reference", "/package-managers/clean");
    expect(reference).toMatch(/^## Caveats\n/);
    expect(reference).toContain(`## Method\n\n${METHOD}\n`);
    expect(reference).toContain(`- This report as JSON: ${ORIGIN}/api/v1/package-managers/clean`);
    expect(reference).toContain("```bibtex");
  });

  it("an unknown section is the page's own 404, with our body and somewhere to go", async () => {
    // The page calls notFound(), so the twin is the handler's 404 with notFoundMarkdown's body.
    expect(await reportTwin(args("/nope"))).toBeUndefined();
    const text = notFoundMarkdown(args("/nope"));
    expect(text).toMatch(
      /^# 404: Page not found\n\nThere is no page at `\/nope` on vlt benchmarks\.\n/,
    );
    expect(text).toContain(`[llms.txt](${ORIGIN}/llms.txt)`);
    expect(notFoundMarkdown(args("/nope/clean"))).toContain("`/nope/clean`");
  });

  it("a path past the scenario is a Markdown 404, where the page renders the scenario", async () => {
    const res = await reportTwin(args("/package-managers/clean/extra"));
    if (!(res instanceof Response)) throw new Error("no response");
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toMatch(/^# 404: Page not found/);
    expect(text).toContain("`/package-managers/clean/extra`");
    expect(text).toContain(`[llms.txt](${ORIGIN}/llms.txt)`);
  });

  it("is cached as long as every twin", () => {
    expect(publicCache).toBe(TWIN_CACHE);
  });

  it("an unknown scenario is a 404 that names the published ones, where the page redirects", async () => {
    const res = await reportTwin(args("/package-managers/nope"));
    if (!(res instanceof Response)) throw new Error("no response");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("published in this run: `clean`");
  });
});

describe("the Methodology twin", () => {
  it("is the fact-checked wording word for word, and every published scenario", async () => {
    const text = String(
      await methodologyTwin({
        params: {},
        searchParams: new URLSearchParams(),
        request: new Request(`${ORIGIN}/methodology.md`),
      }),
    );
    expect(text.split("\n")[0]).toBe(`# Methodology (${ORIGIN}/methodology)`);
    expect(text).toContain(`## Method\n\n${METHOD}\n`);
    expect(text).toContain("- Workflow label: `ubuntu-24.04-arm`");
    expect(text).toContain(RUNNER_NOTE);
    for (const line of READING) expect(text).toContain(`- ${line}`);
    expect(text).toContain(
      `- [clean](${ORIGIN}/package-managers/clean.md): A first install on a fresh machine.`,
    );
    expect(text).toContain("Before each run: binary preinstalled, cache empty, lockfile absent");
    expect(text).toContain(`- [registry-clean](${ORIGIN}/registries/registry-clean.md)`);
    expect(text).toContain(
      "- Methodology: https://github.com/vltpkg/benchmarks/blob/main/docs/METHODOLOGY.md",
    );
    expect(text.trimEnd().endsWith(TRADEMARK)).toBe(true);
    expect(text).not.toMatch(/Ampere|Graviton|Neoverse/);
  });
});

describe("the About twin", () => {
  it("is the llms.txt index", async () => {
    const request = new Request(`${ORIGIN}/about.md`);
    expect(await aboutTwin({ params: {}, searchParams: new URLSearchParams(), request })).toBe(
      await (await llms(request)).text(),
    );
  });
});
