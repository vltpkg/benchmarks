import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as catalog } from "../src/app/api/v1/catalog/route.ts";
import { GET as runs } from "../src/app/api/v1/runs/route.ts";
import { GET as report } from "../src/app/api/v1/[section]/[scenario]/route.ts";
import { GET as history } from "../src/app/api/v1/[section]/[scenario]/history/route.ts";
import { GET as llmsFull } from "../src/app/llms-full.txt/route.ts";
import { GET as llms } from "../src/app/llms.txt/route.ts";
import { GET as markdown } from "../src/app/llms.mdx/[[...slug]]/route.ts";
import { GET as openapi } from "../src/app/openapi.json/route.ts";
import { METHOD, READING, RUNNER_NOTE, TRADEMARK } from "../src/lib/metadata.ts";
import { DATA_URL, fakeFetch } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.vlt.sh";
const get = (path: string) => new Request(`${ORIGIN}${path}`);
const scenario = (section: string, scenario: string) => ({
  params: Promise.resolve({ section, scenario }),
});

beforeAll(() => {
  vi.stubEnv("DATA_URL", DATA_URL);
  vi.stubGlobal("fetch", fakeFetch);
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("JSON API", () => {
  it("runs", async () => {
    expect(await (await runs()).json()).toEqual({
      latest: "2026-10-13",
      dates: ["2026-10-10", "2026-10-12", "2026-10-13"],
    });
  });

  it("catalog: sections, scenarios, tools and fixtures of the latest run", async () => {
    const body = await (await catalog()).json();
    const pm = body.sections.find((s: { id: string }) => s.id === "package-managers");
    expect(pm.scenarios.map((s: { variation: string }) => s.variation)).toEqual(["clean"]);
    expect(pm.tools.map((t: { key: string }) => t.key).sort()).toEqual([
      "bun",
      "npm",
      "vlt",
      "zpm",
    ]);
    expect(pm.fixtures.map((f: { key: string }) => f.key)).toEqual(["astro", "babylon"]);
  });

  it("a scenario's report, with the page's parameters", async () => {
    const res = await report(
      get("/api/v1/package-managers/clean?fixture=astro"),
      scenario("package-managers", "clean"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters.fixture).toBe("astro");
    expect(body.finding.sentence).toMatch(/^On Astro, /);
  });

  it("history, narrowed to tools", async () => {
    const res = await history(
      get("/api/v1/package-managers/clean/history?tools=bun,npm"),
      scenario("package-managers", "clean"),
    );
    const body = await res.json();
    expect(body.tools).toEqual(["bun", "npm"]);
    expect(body.rows[1]).toEqual({ date: "2026-10-11", bun: null, npm: null });
  });

  it("errors are { error: { code, message, hint } }, never a fallback", async () => {
    const cases: [Response, number, string][] = [
      [await report(get("/api/v1/nope/clean"), scenario("nope", "clean")), 404, "unknown_section"],
      [
        await report(get("/api/v1/package-managers/nope"), scenario("package-managers", "nope")),
        404,
        "unknown_scenario",
      ],
      [
        await report(
          get("/api/v1/package-managers/clean?date=2020-01-01"),
          scenario("package-managers", "clean"),
        ),
        400,
        "unknown_selection",
      ],
      [
        await history(
          get("/api/v1/package-managers/clean/history?tools=yarn"),
          scenario("package-managers", "clean"),
        ),
        400,
        "unknown_tool",
      ],
      [
        await history(
          get("/api/v1/package-managers/clean/history?from=2026-10-11&to=2026-10-13"),
          scenario("package-managers", "clean"),
        ),
        400,
        "invalid_window",
      ],
    ];
    for (const [res, status, code] of cases) {
      expect(res.status).toBe(status);
      const { error } = await res.json();
      expect(error.code).toBe(code);
      expect(error.message).toBeTruthy();
      expect(error.hint).toBeTruthy();
    }
  });

  it("openapi.json is OpenAPI 3.1 and describes every route", async () => {
    const body = await (await openapi(get("/openapi.json"))).json();
    expect(body.openapi).toBe("3.1.0");
    expect(Object.keys(body.paths)).toEqual([
      "/api/v1/runs",
      "/api/v1/catalog",
      "/api/v1/{section}/{scenario}",
      "/api/v1/{section}/{scenario}/history",
      "/{section}/{scenario}.md",
    ]);
  });
});

describe("Markdown twins", () => {
  const md = (slug: string[] | undefined, search = "") =>
    markdown(get(`/llms.mdx/${(slug ?? []).join("/")}${search}`), {
      params: Promise.resolve({ slug }),
    });

  it("a scenario page, for exactly the filtered view", async () => {
    const res = await md(["package-managers", "clean"], "?fixture=astro");
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    const text = await res.text();
    expect(text).toContain("  - fixture: astro");
    expect(text).toContain("On Astro, ");
  });

  it("a section with nothing to average opens on its first scenario", async () => {
    expect(await (await md(["package-managers"])).text()).toMatch(/^# Package managers — clean /);
  });

  it("an unknown page is a Markdown 404 with somewhere to go", async () => {
    const res = await md(["nope"]);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toMatch(/^# 404: Page not found/);
    expect(text).toContain(`[llms.txt](${ORIGIN}/llms.txt)`);
  });

  it("methodology: the fact-checked wording word for word, and every published scenario", async () => {
    const res = await md(["methodology"]);
    expect(res.status).toBe(200);
    const text = await res.text();
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

  it("the home page's twin is llms.txt", async () => {
    expect(await (await md(undefined)).text()).toBe(await (await llms(get("/llms.txt"))).text());
  });

  it("llms.txt indexes every page as Markdown, and documents the API and MCP", async () => {
    const text = await (await llms(get("/llms.txt"))).text();
    expect(text).toContain(`- [clean](${ORIGIN}/package-managers/clean.md)`);
    expect(text).toContain(`- [registry-clean](${ORIGIN}/registries/registry-clean.md)`);
    expect(text).toContain(`[Methodology](${ORIGIN}/methodology.md)`);
    expect(text).toContain(`claude mcp add --transport http vlt-benchmarks ${ORIGIN}/mcp`);
    expect(text).toContain("nightly");
  });

  it("llms-full.txt holds every scenario of the latest run", async () => {
    const text = await (await llmsFull(get("/llms-full.txt"))).text();
    expect(text.match(/^# .+ — .+ \(/gm)).toEqual([
      `# Registries — registry-clean (`,
      `# Package managers — clean (`,
    ]);
  });
});
