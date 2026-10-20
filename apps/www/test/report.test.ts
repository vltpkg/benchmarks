import { describe, expect, it } from "vitest";
import { loadReportParams } from "../src/lib/params.ts";
import { ignoredSelection, loadReport, type ReportModel } from "../src/lib/report.ts";
import { fixtureClient } from "./fixture-tree.ts";

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
    expect(r.trend.rows.map((row) => row.date)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(r.trend.rows[1]?.["bun"]).toBeNull();
    expect(r.trend.rows[2]?.["npm"]).toBeNull();
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
