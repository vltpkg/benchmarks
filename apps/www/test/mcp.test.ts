import { describe, expect, it } from "vitest";
import {
  compareScenarios,
  getHistory,
  getResults,
  inputs,
  listBenchmarks,
} from "../src/lib/mcp.ts";
import { fixtureClient } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.vlt.sh";

describe("MCP tools", () => {
  it("list_benchmarks: the catalog and every run", async () => {
    const result = await listBenchmarks(fixtureClient());
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toContain("Latest run: 2026-10-13. Published runs: 3");
    expect(result.content[0]?.text).toContain("- `clean`: A first install");
    expect(result.structuredContent).toMatchObject({ runs: { latest: "2026-10-13" } });
  });

  it("get_results: the page's headline, as Markdown and as data", async () => {
    const result = await getResults(
      { section: "package-managers", scenario: "clean" },
      ORIGIN,
      fixtureClient(),
    );
    expect(result.content[0]?.text).toContain("bun is fastest at 2.00s, 10.0× faster than npm.");
    expect(result.structuredContent).toMatchObject({
      finding: { sentence: "bun is fastest at 2.00s, 10.0× faster than npm." },
    });
  });

  it("get_history: the trend for the tools asked for", async () => {
    const result = await getHistory(
      { section: "package-managers", scenario: "clean", tools: ["npm"] },
      ORIGIN,
      fixtureClient(),
    );
    expect(result.content[0]?.text).toContain(
      "date,npm\n2026-10-10,24\n2026-10-11,\n2026-10-12,\n2026-10-13,20",
    );
    expect(result.structuredContent).toMatchObject({ tools: ["npm"], metric: "total" });
  });

  it("compare_scenarios: each scenario's means, partial ones marked", async () => {
    const result = await compareScenarios(
      { section: "package-managers", tools: ["zpm", "bun"] },
      fixtureClient(),
    );
    expect(result.content[0]?.text).toContain("| yarn (zpm) | 0.5 (1/2) |");
    expect(result.content[0]?.text).toContain("| bun | 2 |");
  });

  it("refuses unknown scenarios, dates and tools explicitly", async () => {
    const client = fixtureClient();
    const errors = await Promise.all([
      getResults({ section: "package-managers", scenario: "nope" }, ORIGIN, client),
      getResults(
        { section: "package-managers", scenario: "clean", date: "2020-01-01" },
        ORIGIN,
        client,
      ),
      getHistory(
        { section: "package-managers", scenario: "clean", tools: ["yarn"] },
        ORIGIN,
        client,
      ),
      compareScenarios({ section: "package-managers", date: "2020-01-01" }, client),
    ]);
    expect(
      errors.map((e) => [e.isError, (e.structuredContent.error as { code: string }).code]),
    ).toEqual([
      [true, "unknown_scenario"],
      [true, "unknown_selection"],
      [true, "unknown_tool"],
      [true, "unknown_selection"],
    ]);
  });

  it("validates input with the URL parameters' rules", () => {
    expect(inputs.get_results.safeParse({ section: "nope", scenario: "clean" }).success).toBe(
      false,
    );
    expect(
      inputs.get_history.safeParse({ section: "registries", scenario: "x", from: "13/10/2026" })
        .success,
    ).toBe(false);
    expect(
      inputs.get_history.safeParse({
        section: "registries",
        scenario: "x",
        exclude: ["npm@2026-10-12"],
      }).success,
    ).toBe(true);
    expect(
      inputs.get_results.safeParse({ section: "registries", scenario: "x", metric: "fastest" })
        .success,
    ).toBe(false);
  });
});
