import { describe, expect, it } from "vitest";
import { rowsOf, toTrendColumns, trendOf, type TrendRun } from "../src/lib/chart-model.ts";
import { loadReportParams } from "../src/lib/params.ts";
import { ignoredSelection, loadReport, type ReportModel } from "../src/lib/report.ts";
import { DataClient } from "@benchmarks/data";
import { loadScenario, loadSummaries, TREND_BUDGET } from "../src/lib/load.ts";
import { DATA_URL, DATES, fakeFetch, fixtureClient, summarisedClient } from "./fixture-tree.ts";

const load = async (scenario: string | undefined, search = "", section = "package-managers") =>
  loadReport({
    section,
    scenario,
    query: loadReportParams(new URLSearchParams(search)),
    client: fixtureClient(),
  });

const report = async (search = ""): Promise<ReportModel> => {
  const result = await load("clean", search);
  if (result.status !== "ok") throw new Error(result.status);
  return result.report;
};

describe("loadReport", () => {
  it("states the run, the scenario and the headline from the files", async () => {
    const r = await report();
    expect(r.run).toMatchObject({ date: "2026-10-13", latest: "2026-10-13", isLatest: true });
    expect(r.scenario.variation).toBe("clean");
    expect(r.fixtures).toEqual(["astro", "babylon"]);
    expect(r.finding.sentence).toBe("bun is fastest at 2.00s, 10.0× faster than npm.");
    expect(r.stats?.map((s) => s.value)).toEqual(["2.00s", "10.0×", "1 / 2", "10.0×"]);
  });

  it("keeps a DNF out of the numbers, and says the tool is partial", async () => {
    const r = await report();
    const zpm = r.leaderboard.find((row) => row.tool === "zpm");
    expect(zpm).toMatchObject({ fixtures: 1, failed: true, mean: 0.5 });
    expect(r.timeRows.find((row) => row.fixture === "babylon")?.failed).toEqual(["zpm"]);
    expect(r.timeBars.partial).toEqual(["zpm"]);
    expect(r.caveats.qualifier).toMatch(/`yarn \(zpm\)` posted a lower mean/);
    expect(r.caveats.leaderboard[0]?.title).toBe("yarn (zpm) did not complete every fixture");
    expect(r.caveats.timeBars[0]?.title).toBe("Not drawn: yarn (zpm)");
  });

  it("leaves gaps in the trend as gaps, and compares only with a real previous run", async () => {
    const r = await report();
    const rows = rowsOf(r.trend.series);
    expect(rows.map((row) => row.date)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(rows[1]?.["bun"]).toBeNull();
    expect(rows[2]?.["npm"]).toBeNull();
    expect(r.leaderboard.find((row) => row.tool === "npm")?.sinceLastRun).toBeNull();
    expect(r.leaderboard.find((row) => row.tool === "bun")?.sinceLastRun).toBeCloseTo(-1 / 11);
    expect(r.trend.markers.map((m) => m.label)).toEqual(["vlt 1.1.0"]);
  });

  it("narrows to one fixture and says so in the headline", async () => {
    const r = await report("fixture=astro");
    expect(r.filters.fixture).toBe("astro");
    expect(r.finding.sentence).toMatch(/^On Astro, /);
  });

  it("scopes the headline to the tools left, and says which are hidden", async () => {
    const [all, hidden, everything] = await Promise.all([
      report(),
      report("hide=bun"),
      report("hide=zpm,bun,vlt,npm"),
    ]);
    expect(hidden.finding.sentence).toMatch(/^With bun hidden, /);
    expect(hidden.finding.subject).not.toBe("bun");
    expect(hidden.filters.hide).toEqual(["bun"]);
    expect(hidden.caveats.hidden?.title).toBe("1 of 4 tools hidden");
    // Hiding every tool hides nothing from the headline.
    expect(everything.finding).toEqual(all.finding);
  });

  it("falls back from an unpublished date, and a strict reader can tell", async () => {
    const query = loadReportParams(new URLSearchParams("date=2020-01-01"));
    const r = await report("date=2020-01-01");
    expect(r.run.date).toBe("2026-10-13");
    expect(ignoredSelection(query, r)).toBe("No run was published on 2020-01-01.");
  });

  it("names what it cannot find", async () => {
    expect(await load("clean", "", "nope")).toEqual({ status: "unknown-section", section: "nope" });
    expect(await load("nope")).toMatchObject({
      status: "unknown-scenario",
      scenarios: ["clean"],
      href: "/package-managers/clean",
    });
    expect((await load(undefined, "", "task-runners")).status).toBe("no-results");
  });

  it("is plain data", async () => {
    const r = await report();
    expect(() => structuredClone(r)).not.toThrow();
  });
});

describe("a trend read from the summaries", () => {
  const load = async (client: Parameters<typeof loadReport>[0]["client"], search: string) => {
    const result = await loadReport({
      section: "package-managers",
      scenario: "clean",
      query: loadReportParams(new URLSearchParams(search)),
      client,
    });
    if (result.status !== "ok") throw new Error(result.status);
    return result.report;
  };

  it("draws exactly what the files draw: the same points, gaps, DNFs and per-package times", async () => {
    for (const search of [
      "range=all",
      "range=all&metric=per-package",
      "range=all&fixture=babylon",
    ]) {
      const files = await load(fixtureClient(), search);
      const { client } = summarisedClient();
      const summarised = await load(client, search);
      expect(summarised.trend).toEqual(files.trend);
      expect(summarised.leaderboard).toEqual(files.leaderboard);
    }
  });

  it("costs one fetch a run instead of one per fixture", async () => {
    const { client, fetched } = summarisedClient();
    await load(client, "range=all");
    const benchmarks = fetched.filter((p) => /^\d{4}-\d{2}-\d{2}\/[a-z]+-clean\.json$/.test(p));
    // Only the run shown reads its files, for its tables; the trend reads none.
    expect(benchmarks.sort()).toEqual([
      "2026-10-13/astro-clean.json",
      "2026-10-13/babylon-clean.json",
    ]);
    expect(fetched.filter((p) => p.startsWith("summary/")).sort()).toEqual(
      DATES.map((d) => `summary/${d}.json`),
    );
  });

  const trendFetches = (fetched: readonly string[], kind: RegExp) =>
    fetched.filter((p) => kind.test(p) && !p.startsWith("2026-10-13/")).length;

  it("reads counts and versions from a summary that carries them, and fetches none", async () => {
    const { client, fetched } = summarisedClient();
    const r = await load(client, "range=all&metric=per-package");
    expect(trendFetches(fetched, /-package-count\.json$/)).toBe(0);
    expect(trendFetches(fetched, /\/versions\.json$/)).toBe(0);
    // ...and draws exactly what the files draw.
    const files = await load(fixtureClient(), "range=all&metric=per-package");
    expect(r.trend).toEqual(files.trend);
  });

  it("falls back to the files for a summary written before it carried them", async () => {
    const { client, fetched } = summarisedClient({ old: true });
    const r = await load(client, "range=all&metric=per-package");
    // Two fixtures on each earlier run, and one versions.json each.
    expect(trendFetches(fetched, /-package-count\.json$/)).toBe(2 * (DATES.length - 1));
    expect(trendFetches(fetched, /\/versions\.json$/)).toBe(DATES.length - 1);
    const files = await load(fixtureClient(), "range=all&metric=per-package");
    expect(r.trend).toEqual(files.trend);
  });

  it("falls back per fixture for a count the summary leaves out", async () => {
    const { client, fetched } = summarisedClient({ uncounted: "babylon" });
    const r = await load(client, "range=all&metric=per-package");
    // Only babylon's, on each earlier run; astro's come from the summary.
    expect(
      fetched.filter((p) => p.endsWith("-package-count.json") && !p.startsWith("2026-10-13/")),
    ).toEqual(DATES.slice(0, -1).map((d) => `${d}/babylon-clean-package-count.json`));
    const files = await load(fixtureClient(), "range=all&metric=per-package");
    expect(r.trend).toEqual(files.trend);
  });
});

describe("a trend's fetch budget", () => {
  /* Far more runs than the budget pays for, none with a summary. */
  const window = Array.from({ length: 300 }, (_, i) =>
    new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
  );
  const counting = (summaries: "missing" | "failed") => {
    const fetched: string[] = [];
    const fetch = async (url: string | URL | Request) => {
      const path = decodeURIComponent(String(url).slice(DATA_URL.length + 1));
      fetched.push(path);
      if (summaries === "failed" && path.startsWith("summary/")) {
        return { ok: false, status: 500, json: async () => null };
      }
      return fakeFetch(url);
    };
    return { client: new DataClient({ baseUrl: DATA_URL, fetch }), fetched };
  };

  for (const summaries of ["missing", "failed"] as const) {
    it(`never fans out past it when every summary is ${summaries}`, async () => {
      const { client, fetched } = counting(summaries);
      const data = await loadScenario(client, "2026-10-13", "clean", ["astro", "babylon"], window, {
        perPackage: true,
        summaries: loadSummaries(client, window),
      });
      // Two fixtures, each with its count: four files a run, so the newest 100 runs.
      expect(data.trendCost).toMatchObject({ perRun: 4, dates: TREND_BUDGET / 4 });
      const newest = new Set(window.slice(-TREND_BUDGET / 4));
      const trendFiles = fetched.filter(
        (p) => !p.startsWith("summary/") && !p.startsWith("2026-10-13/"),
      );
      expect(trendFiles.length).toBeLessThanOrEqual(TREND_BUDGET);
      expect(trendFiles.every((p) => newest.has(p.split("/")[0] ?? ""))).toBe(true);
    });
  }
});

describe("the trend's run detail by column", () => {
  const detail = ({ date, fixtures, partial, failed, byFixture, rsd, rsdByFixture }: TrendRun) => ({
    date,
    fixtures,
    partial,
    failed,
    byFixture,
    rsd,
    rsdByFixture,
  });

  it("gives back every run exactly: DNFs, partial means, a tool missing a run", async () => {
    const r = await report("range=all");
    const runs = r.trend.points.map(detail);
    // The fixture tree has zpm failing babylon (partial, failed) and npm absent on one run.
    expect(runs.some((p) => Object.keys(p.failed).length > 0)).toBe(true);
    expect(runs.some((p) => Object.keys(p.partial).length > 0)).toBe(true);
    expect(runs.some((p) => p.byFixture["npm"] === undefined)).toBe(true);
    expect(trendOf(toTrendColumns(runs))).toEqual(runs);
  });

  it("keeps an absent spread absent, a zero a zero, and fixtures in each run's order", () => {
    const runs: TrendRun[] = [
      {
        date: "2026-01-01",
        fixtures: ["vue", "astro"],
        partial: { zpm: { mean: 0.5, of: 1 } },
        failed: { zpm: [{ fixture: "vue", exit: 1 }] },
        byFixture: { npm: { vue: 1 / 3, astro: 2 }, zpm: { astro: 0.5 } },
        rsd: { npm: 0, zpm: 0.1 },
        rsdByFixture: { npm: { astro: 0 } },
      },
      {
        date: "2026-01-03",
        fixtures: ["astro"],
        partial: {},
        failed: {},
        byFixture: { bun: { astro: 0.25 } },
        rsd: { bun: 0.02 },
        rsdByFixture: {},
      },
    ];
    const columns = toTrendColumns(runs);
    expect(trendOf(columns)).toEqual(runs);
    expect(columns.byFixture["npm"]?.["vue"]).toEqual([1 / 3, null]);
    expect(trendOf(toTrendColumns([]))).toEqual([]);
  });

  it("is smaller than the runs it encodes", async () => {
    const runs = (await report("range=all")).trend.points.map(detail);
    expect(JSON.stringify(toTrendColumns(runs)).length).toBeLessThan(JSON.stringify(runs).length);
  });
});
