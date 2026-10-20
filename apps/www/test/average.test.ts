import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DataClient } from "@benchmarks/data";
import nextConfig from "../next.config.ts";
import type { BenchmarkFile } from "@benchmarks/types";
import { GET as api } from "../src/app/api/v1/[section]/[scenario]/route.ts";
import { GET as llms } from "../src/app/llms.txt/route.ts";
import { GET as markdown } from "../src/app/llms.mdx/[[...slug]]/route.ts";
import { AVERAGE_TREND_BUDGET, averageTrendDates } from "../src/lib/load.ts";
import { averageFiles } from "../src/lib/measurements.ts";
import { treeFor } from "../src/lib/page-tree.ts";
import { loadReportParams } from "../src/lib/params.ts";
import { loadReport } from "../src/lib/report.ts";
import { AVERAGE, scenariosFor, withAverage } from "../src/lib/scenarios.ts";
import { DATA_URL, fakeFetch } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.vlt.sh";

const result = (command: string, mean: number, exit = 0) => ({
  command,
  mean,
  stddev: 0,
  median: mean,
  min: mean,
  max: mean,
  user: mean,
  system: 0,
  times: [mean],
  exit_codes: [exit],
});
const file = (...results: ReturnType<typeof result>[]): BenchmarkFile => ({ results });

/* The shared tree, plus a `cache` scenario at half of `clean`'s times: two to average. */
const withCache = async (url: string | URL | Request) => {
  const path = decodeURIComponent(String(url).slice(DATA_URL.length + 1));
  const cache = /^(.+)-cache\.json$/.exec(path);
  if (cache !== null) {
    const clean = (await (await fakeFetch(`${DATA_URL}/${cache[1]}-clean.json`)).json()) as
      | BenchmarkFile
      | undefined;
    const body = clean && { results: clean.results.map((r) => ({ ...r, mean: r.mean / 2 })) };
    return { ok: body !== undefined, status: body ? 200 : 404, json: async () => body };
  }
  const res = await fakeFetch(url);
  if (!path.startsWith("manifest/") || !res.ok) return res;
  const entry = (await res.json()) as { benchmarks: { [f: string]: string[] } };
  const benchmarks = Object.fromEntries(
    Object.entries(entry.benchmarks).map(([f, v]) => [f, [...v, "cache"]]),
  );
  return { ...res, json: async () => ({ ...entry, benchmarks }) };
};
const client = () => new DataClient({ baseUrl: DATA_URL, fetch: withCache });

describe("averageFiles", () => {
  const plan = { astro: ["clean", "cache"] };

  it("averages a tool's times only where it completed every scenario", () => {
    const [astro] = averageFiles(
      [
        { fixture: "astro", variation: "clean", file: file(result("bun", 2), result("npm", 10)) },
        { fixture: "astro", variation: "cache", file: file(result("bun", 1), result("npm", 4)) },
      ],
      plan,
    );
    expect(astro?.file.results.map((r) => [r.command, r.mean])).toEqual([
      ["bun", 1.5],
      ["npm", 7],
    ]);
  });

  it("a failure in any scenario is DNF, never averaged", () => {
    const [astro] = averageFiles(
      [
        { fixture: "astro", variation: "clean", file: file(result("zpm", 0, 1)) },
        { fixture: "astro", variation: "cache", file: file(result("zpm", 0.2)) },
      ],
      plan,
    );
    expect(astro?.file.results[0]?.mean).toBeNaN();
    expect(astro?.file.results[0]?.exit_codes).toEqual([1]);
  });

  it("leaves out a tool not run in every scenario", () => {
    const [astro] = averageFiles(
      [
        { fixture: "astro", variation: "clean", file: file(result("bun", 2), result("npm", 9)) },
        { fixture: "astro", variation: "cache", file: file(result("bun", 1)) },
      ],
      plan,
    );
    expect(astro?.file.results.map((r) => r.command)).toEqual(["bun"]);
  });

  it("drops a fixture missing one of its scenarios' files", () => {
    expect(
      averageFiles([{ fixture: "astro", variation: "clean", file: file(result("bun", 2)) }], plan),
    ).toEqual([]);
  });
});

describe("withAverage", () => {
  it("leads with the derived view, over the curated scenarios only", () => {
    const list = withAverage(scenariosFor("package-managers", ["cache", "clean", "ci+setup"]));
    expect(list.map((s) => s.variation)).toEqual([AVERAGE, "clean", "cache", "ci+setup"]);
    expect(list[0]?.averageOf).toEqual(["clean", "cache"]);
  });

  it("needs two scenarios to average", () => {
    expect(withAverage(scenariosFor("registries", ["registry-clean"]))).toHaveLength(1);
  });

  it("is first in each benchmark's sidebar folder", () => {
    const tree = treeFor({
      registries: scenariosFor("registries", ["registry-clean", "registry-lockfile"]),
      "package-managers": scenariosFor("package-managers", ["clean", "cache"]),
      "task-runners": scenariosFor("task-runners", ["build", "run"]),
    });
    for (const node of tree.children) {
      if (node.type !== "folder") continue;
      expect(node.children[0]).toMatchObject({ type: "page", name: AVERAGE });
    }
  });
});

describe("default routes", () => {
  it("/ opens, temporarily, on the registries average, and nothing redirects away from average", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual({
      source: "/",
      destination: "/registries/average",
      permanent: false,
    });
    expect(redirects.some((r) => r.source.includes("average"))).toBe(false);
  });
});

describe("averageTrendDates", () => {
  it("cuts the window to the newest runs the budget pays for", () => {
    const dates = Array.from({ length: 30 }, (_, i) => `d${i}`);
    expect(averageTrendDates(dates, 54)).toEqual(dates.slice(-7));
    expect(7 * 54).toBeLessThanOrEqual(AVERAGE_TREND_BUDGET);
    expect(averageTrendDates(dates, 12)).toEqual(dates);
    expect(averageTrendDates(dates, 1000)).toHaveLength(2);
  });
});

describe("the average report", () => {
  const load = async (search = "") => {
    const r = await loadReport({
      section: "package-managers",
      scenario: AVERAGE,
      query: loadReportParams(new URLSearchParams(search)),
      client: client(),
    });
    if (r.status !== "ok") throw new Error(r.status);
    return r.report;
  };

  it("ranks the per-fixture means, and keeps a DNF a DNF", async () => {
    const report = await load();
    expect(report.scenario.averageOf).toEqual({
      scenarios: ["clean", "cache"],
      byFixture: { astro: ["clean", "cache"], babylon: ["clean", "cache"] },
    });
    expect(report.finding.sentence).toBe("bun is fastest at 1.50s, 10.0× faster than npm.");
    expect(report.timeRows.find((r) => r.fixture === "babylon")?.failed).toEqual(["zpm"]);
  });

  it("has no counts, no per-package metric, and cites every file it averaged", async () => {
    const report = await load("metric=per-package");
    expect(report.outline.map((s) => s.id)).toEqual(["leaderboard", "time"]);
    expect(report.trend.perPackage).toBe(false);
    expect(report.trend.plotted).toBe("total");
    expect(report.raw.map((r) => r.label)).toEqual([
      "Astro · clean",
      "Astro · cache",
      "Babylon.js · clean",
      "Babylon.js · cache",
    ]);
  });

  it("the section opens on it", async () => {
    const r = await loadReport({
      section: "package-managers",
      query: loadReportParams(new URLSearchParams()),
      client: client(),
    });
    expect(r).toMatchObject({
      status: "unknown-scenario",
      opens: AVERAGE,
      href: "/package-managers/average",
    });
  });
});

describe("the average report's twins", () => {
  beforeAll(() => {
    vi.stubEnv("DATA_URL", DATA_URL);
    vi.stubGlobal("fetch", withCache);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("Markdown says it is derived, and of what", async () => {
    const res = await markdown(new Request(`${ORIGIN}/llms.mdx/package-managers/average`), {
      params: Promise.resolve({ slug: ["package-managers", "average"] }),
    });
    const text = await res.text();
    expect(text.split("\n")[0]).toBe(
      `# Package managers — average (${ORIGIN}/package-managers/average)`,
    );
    expect(text).toContain("averaged over 2 scenarios (derived, not measured)");
    expect(text).toContain("Mean of: clean, cache.");
    expect(text).not.toContain("## Footprint");
  });

  it("the section's own Markdown is the average", async () => {
    const res = await markdown(new Request(`${ORIGIN}/llms.mdx/package-managers`), {
      params: Promise.resolve({ slug: ["package-managers"] }),
    });
    expect(await res.text()).toMatch(/^# Package managers — average /);
  });

  it("the JSON API returns it", async () => {
    const res = await api(new Request(`${ORIGIN}/api/v1/package-managers/average`), {
      params: Promise.resolve({ section: "package-managers", scenario: AVERAGE }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenario.averageOf.scenarios).toEqual(["clean", "cache"]);
    expect(body.packageCounts).toEqual([]);
  });

  it("llms.txt lists it first", async () => {
    const text = await (await llms(new Request(`${ORIGIN}/llms.txt`))).text();
    expect(text).toContain(
      `- [average](${ORIGIN}/package-managers/average.md): Every tool across all of this benchmark's scenarios at once.`,
    );
    expect(text.indexOf("- [average]")).toBeLessThan(text.indexOf("- [clean]"));
  });
});
