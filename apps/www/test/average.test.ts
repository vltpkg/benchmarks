import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DataClient } from "@benchmarks/data";
import nextConfig from "../next.config.ts";
import type { BenchmarkFile } from "@benchmarks/types";
import { GET as api } from "../src/app/api/v1/[section]/[scenario]/route.ts";
import reportTwin, { slots } from "../src/app/[section]/[[...params]]/markdown.ts";
import { GET as llms } from "../src/app/llms.txt/route.ts";
import { TREND_BUDGET, trendDates } from "../src/lib/load.ts";
import { averagedNote, reportMarkdown } from "../src/lib/markdown.ts";
import { averageFiles, commonPlan } from "../src/lib/measurements.ts";
import { treeFor } from "../src/lib/page-tree.ts";
import { loadReportParams } from "../src/lib/params.ts";
import { loadReport } from "../src/lib/report.ts";
import { AVERAGE, scenariosFor, withAverage } from "../src/lib/scenarios.ts";
import { DATA_URL, DATES, fakeFetch } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.vlt.io";

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

describe("commonPlan", () => {
  const plan = {
    astro: ["clean", "cache", "add"],
    babylon: ["clean", "cache", "add"],
  };
  const run = (date: string, cells: { [fixture: string]: readonly string[] }) => ({
    date,
    cells: Object.entries(cells).flatMap(([fixture, vs]) =>
      vs.map((variation) => ({ fixture, variation })),
    ),
  });
  const all = { astro: plan.astro, babylon: plan.babylon };
  const before = { astro: ["clean", "cache"], babylon: ["clean", "cache"] };

  it("leaves out a scenario added mid-window, and says when it starts", () => {
    const common = commonPlan(plan, [run("d1", before), run("d2", before), run("d3", all)]);
    expect(common.plan).toEqual(before);
    expect(common.leftOut).toEqual([
      { scenario: "add", fixtures: ["astro", "babylon"], missing: ["d1", "d2"], when: "before" },
    ]);
    expect(common.fallback).toEqual([]);
  });

  it("averages everything in a window that starts after it was added", () => {
    expect(commonPlan(plan, [run("d3", all), run("d4", all)])).toEqual({
      plan: all,
      leftOut: [],
      fallback: [],
    });
  });

  it("leaves out a scenario missing on one run, on that fixture only, and names the run", () => {
    const gap = { astro: ["clean", "add"], babylon: plan.babylon };
    const common = commonPlan(plan, [run("d1", all), run("d2", gap), run("d3", all)]);
    expect(common.plan).toEqual({ astro: ["clean", "add"], babylon: plan.babylon });
    expect(common.leftOut).toEqual([
      { scenario: "cache", fixtures: ["astro"], missing: ["d2"], when: "between" },
    ]);
  });

  it("ignores a run a fixture did not run on at all", () => {
    const common = commonPlan(plan, [run("d1", { babylon: plan.babylon }), run("d2", all)]);
    expect(common.plan).toEqual(all);
  });

  it("falls back to the shown run's set when fewer than two are common", () => {
    const common = commonPlan(
      plan,
      [run("d1", { astro: ["clean"], babylon: ["clean"] }), run("d2", before)],
      "d2",
    );
    expect(common.plan).toEqual(before);
    expect(common.fallback).toEqual(["astro", "babylon"]);
    expect(common.leftOut).toEqual([]);
  });

  it("does not offer a scenario no run has", () => {
    expect(commonPlan(plan, [run("d1", before), run("d2", before)])).toEqual({
      plan: before,
      leftOut: [],
      fallback: [],
    });
  });

  it("names a scenario the shown run lacks and an earlier run has", () => {
    const shown = { astro: ["clean", "cache"], babylon: plan.babylon };
    const common = commonPlan(plan, [run("d1", all), run("d2", shown)], "d2");
    expect(common.plan).toEqual({ astro: ["clean", "cache"], babylon: plan.babylon });
    expect(common.leftOut).toEqual([
      { scenario: "add", fixtures: ["astro"], missing: ["d2"], when: "after" },
    ]);
  });

  it("describes only the runs it is given, not an excluded first run", () => {
    // d2 is the scenario's real first run, excluded by the caller: d3 is not its first.
    const common = commonPlan(plan, [run("d1", before), run("d3", all), run("d4", all)]);
    expect(common.leftOut).toEqual([
      { scenario: "add", fixtures: ["astro", "babylon"], missing: ["d1"], when: "before" },
    ]);
  });

  it("covers only the fixtures it is given", () => {
    const common = commonPlan({ astro: plan.astro }, [run("d1", before), run("d2", all)]);
    expect(common.plan).toEqual({ astro: ["clean", "cache"] });
    expect(common.leftOut).toEqual([
      { scenario: "add", fixtures: ["astro"], missing: ["d1"], when: "before" },
    ]);
  });
});

describe("averagedNote", () => {
  const averageOf = {
    scenarios: ["clean"],
    byFixture: { astro: ["clean"], babylon: ["clean", "cache"] },
    leftOut: [
      { scenario: "add", fixtures: ["astro", "babylon"], missing: ["d1"], when: "before" },
      { scenario: "remove", fixtures: ["astro", "babylon"], missing: ["d3"], when: "after" },
      { scenario: "cache", fixtures: ["astro"], missing: ["d2", "d4"], when: "between" },
    ],
    fallback: [],
  } satisfies Parameters<typeof averagedNote>[0];

  it("names what is left out, grouped by why", () => {
    expect(averagedNote(averageOf)).toBe(
      "Left out, so every run in the trend window averages the same scenarios: `add` (not in runs through d1); `remove` (not in runs since d3); `cache` (on Astro, not in the runs of d2, d4).",
    );
  });

  it("says nothing when nothing is left out", () => {
    expect(averagedNote({ ...averageOf, leftOut: [] })).toBeNull();
  });

  it("says when it fell back", () => {
    expect(averagedNote({ ...averageOf, leftOut: [], fallback: ["astro", "babylon"] })).toBe(
      "Too few scenarios ran on every run in the window to average, so this run's are averaged there, and those fixtures are left out of runs without one of them.",
    );
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

describe("trendDates", () => {
  it("cuts the window to the newest runs the budget pays for", () => {
    const dates = Array.from({ length: 30 }, (_, i) => `d${i}`);
    expect(trendDates(dates, 54)).toEqual(dates.slice(-7));
    expect(7 * 54).toBeLessThanOrEqual(TREND_BUDGET);
    expect(trendDates(dates, 12)).toEqual(dates);
    expect(trendDates(dates, 1000)).toHaveLength(2);
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
      leftOut: [],
      fallback: [],
    });
    expect(report.finding.sentence).toBe("bun is fastest at 1.50s, 10.0× faster than npm.");
    expect(report.timeRows.find((r) => r.fixture === "babylon")?.failed).toEqual(["zpm"]);
  });

  it("averages only what every run in the window has, and says what it left out", async () => {
    /* `add-singleton` published, as `clean`'s files again, on the runs given only. */
    const addedOn = (runs: readonly string[]) => async (url: string | URL | Request) => {
      const path = decodeURIComponent(String(url).slice(DATA_URL.length + 1));
      const add = /^([\d-]+)\/(.+)-add-singleton\.json$/.exec(path);
      if (add !== null) {
        return runs.includes(add[1] ?? "")
          ? fakeFetch(`${DATA_URL}/${add[1]}/${add[2]}-clean.json`)
          : { ok: false, status: 404, json: async () => undefined };
      }
      const res = await withCache(url);
      const run = /^manifest\/(.+)\.json$/.exec(path)?.[1];
      if (run === undefined || !runs.includes(run) || !res.ok) return res;
      const entry = (await res.json()) as { benchmarks: { [f: string]: string[] } };
      const benchmarks = Object.fromEntries(
        Object.entries(entry.benchmarks).map(([f, v]) => [f, [...v, "add-singleton"]]),
      );
      return { ...res, json: async () => ({ ...entry, benchmarks }) };
    };
    const at = async (search: string, runs: readonly string[] = ["2026-10-13"]) => {
      const r = await loadReport({
        section: "package-managers",
        scenario: AVERAGE,
        query: loadReportParams(new URLSearchParams(search)),
        client: new DataClient({ baseUrl: DATA_URL, fetch: addedOn(runs) }),
      });
      if (r.status !== "ok") throw new Error(r.status);
      return r.report;
    };

    const window = await at("from=2026-10-10&to=2026-10-13");
    expect(window.scenario.averageOf?.scenarios).toEqual(["clean", "cache"]);
    expect(window.scenario.averageOf?.leftOut).toEqual([
      {
        scenario: "add-singleton",
        fixtures: ["astro", "babylon"],
        missing: ["2026-10-10", "2026-10-12"],
        when: "before",
      },
    ]);
    expect(window.trend.points.map((p) => p.date)).toEqual(DATES);
    expect(window.raw.map((r) => r.label)).not.toContain("Astro · add-singleton");
    expect(reportMarkdown(window, ORIGIN)).toContain(
      "Left out, so every run in the trend window averages the same scenarios: `add-singleton` (not in runs through 2026-10-12).",
    );

    /* Shown at a run without it, after runs that have it: still named, not silently missing. */
    const dropped = await at("from=2026-10-10&to=2026-10-13", ["2026-10-10", "2026-10-12"]);
    expect(dropped.scenario.averageOf?.scenarios).toEqual(["clean", "cache"]);
    expect(dropped.scenario.averageOf?.leftOut).toEqual([
      {
        scenario: "add-singleton",
        fixtures: ["astro", "babylon"],
        missing: ["2026-10-13"],
        when: "after",
      },
    ]);
    expect(reportMarkdown(dropped, ORIGIN)).toContain(
      "`add-singleton` (not in runs since 2026-10-13).",
    );

    const latest = await at("from=2026-10-13&to=2026-10-13");
    expect(latest.scenario.averageOf?.scenarios).toEqual(["clean", "cache", "add-singleton"]);
    expect(latest.scenario.averageOf?.leftOut).toEqual([]);

    const astro = await at("from=2026-10-10&to=2026-10-13&fixture=astro");
    expect(astro.scenario.averageOf?.byFixture).toEqual({ astro: ["clean", "cache"] });
    expect(astro.scenario.averageOf?.leftOut[0]?.fixtures).toEqual(["astro"]);
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

  /* The handler's args for `/package-managers/average`, as twins.test.ts builds them. */
  const twin = (path: string) => {
    const [section = "", ...rest] = path.split("/").slice(1);
    return {
      route: "/[section]/[[...params]]" as const,
      params: rest.length === 0 ? { section } : { section, params: rest },
      searchParams: new URLSearchParams(),
      request: new Request(`${ORIGIN}/api/affordances/md${path}`),
    };
  };

  it("its Markdown twin says it is derived, and of what", async () => {
    const context = await slots.context(twin("/package-managers/average"));
    expect(context).toContain("averaged over 2 scenarios (derived, not measured)");
    expect(context).toContain("Mean of: clean, cache.");
  });

  it("the section's own twin is the page's redirect to the average", async () => {
    expect(await reportTwin(twin("/package-managers"))).toBeUndefined();
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

describe("trendDates with summaries", () => {
  it("keeps every summarised date and budgets only the rest", () => {
    const dates = Array.from({ length: 30 }, (_, i) => `d${String(i).padStart(2, "0")}`);
    const summarised = new Set(dates.slice(0, 20));
    // 54 files a run leaves room for 7 raw runs: the last 7 of the 10 unsummarised.
    expect(trendDates(dates, 54, summarised)).toEqual([...dates.slice(0, 20), ...dates.slice(23)]);
    expect(trendDates(dates, 54, new Set(dates))).toEqual(dates);
  });
});
