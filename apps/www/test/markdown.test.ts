import { describe, expect, it } from "vitest";
import { historyOf } from "../src/lib/api.ts";
import { historyMarkdown, reportMarkdown } from "../src/lib/markdown.ts";
import { mdxSource, tocOf } from "../src/lib/mdx.ts";
import { METHOD, RUNNER_NOTE } from "../src/lib/metadata.ts";
import { loadReportParams } from "../src/lib/params.ts";
import { loadReport, type ReportModel } from "../src/lib/report.ts";
import { fixtureClient } from "./fixture-tree.ts";

const ORIGIN = "https://benchmarks.example";

const report = async (search = ""): Promise<ReportModel> => {
  const result = await loadReport({
    section: "package-managers",
    scenario: "clean",
    query: loadReportParams(new URLSearchParams(search)),
    client: fixtureClient(),
  });
  if (result.status !== "ok") throw new Error(result.status);
  return result.report;
};

describe("reportMarkdown", () => {
  it("opens with the page, the run and every filter in effect", async () => {
    const md = reportMarkdown(await report("fixture=astro&hide=vlt"), ORIGIN);
    expect(md.split("\n")[0]).toBe(
      `# Package managers — clean (${ORIGIN}/package-managers/clean?fixture=astro&hide=vlt)`,
    );
    expect(md).toContain("- Run: 2026-10-13 (the latest run). Results regenerate nightly.");
    expect(md).toContain("  - fixture: astro");
    expect(md).toContain("  - hidden tools: vlt");
    expect(md).toContain("On Astro, with vlt hidden, yarn (zpm) is fastest at 500ms");
  });

  it("writes the tables as GFM, with DNF and absences spelled out", async () => {
    const md = reportMarkdown(await report(), ORIGIN);
    expect(md).toContain(
      "| # | Tool | Key | Mean (s) | ±RSD | Against npm | Since last run | Fixtures | Version |",
    );
    expect(md).toContain("| 1 | yarn (zpm) | zpm | 0.5 | 5.0% | 40.0× faster | — | 1/2, DNF | — |");
    expect(md).toContain("| yarn (zpm) | 0.5 | DNF |");
    expect(md).toContain("## Per-package time by fixture (ms per installed package, derived)");
    expect(md).toContain("| npm | 110 (108–112) | 110 (108–112) | 220 |");
  });

  it("gives the trend as CSV, one row per day, with empty cells for gaps", async () => {
    const md = reportMarkdown(await report(), ORIGIN);
    const csv = md.slice(md.indexOf("```csv\n") + 7, md.indexOf("\n```", md.indexOf("```csv")));
    expect(csv.split("\n")).toEqual([
      "date,zpm,bun,vlt,npm",
      "2026-10-10,,2.4,4.8,24",
      "2026-10-11,,,,",
      "2026-10-12,,2.2,4.4,",
      "2026-10-13,,2,4,20",
    ]);
    expect(md).toContain("- yarn (zpm) on Babylon.js: DNF on 3 runs (exit 1)");
    expect(md).toContain("- 2026-10-13: vlt 1.0.0 → 1.1.0");
  });

  it("draws the trend in the reader's metric, labelled derived, as the chart does", async () => {
    const md = reportMarkdown(await report("metric=change"), ORIGIN);
    const csv = md.slice(md.indexOf("```csv\n") + 7, md.indexOf("\n```", md.indexOf("```csv")));
    expect(md).toContain("  - trend metric: change since the first run in the window (derived)");
    expect(csv.split("\n")[1]).toBe("2026-10-10,,0,0,0");
    expect(csv.split("\n").at(-1)).toBe("2026-10-13,,-16.667,-16.667,-16.667");
  });

  it("writes out the caveats, the method and the environment word for word", async () => {
    const md = reportMarkdown(await report(), ORIGIN);
    expect(md).toContain("- yarn (zpm) did not complete every fixture. Runs that exited non-zero");
    expect(md).toContain("Per-package time by tool — Not drawn: yarn (zpm).");
    expect(md).toContain("- Disclosure. vlt publishes this benchmark");
    expect(md).toContain(`## Method\n\n${METHOD}\n`);
    expect(md).toContain("- Workflow label: `ubuntu-24.04-arm`");
    expect(md).toContain(RUNNER_NOTE);
    expect(md).toContain(`- This report as JSON: ${ORIGIN}/api/v1/package-managers/clean`);
    expect(md).toContain(
      "- Raw results, Astro (JSON): http://data.test/2026-10-13/astro-clean.json",
    );
    expect(md).toContain(`- URL: ${ORIGIN}/package-managers/clean?date=2026-10-13`);
  });

  it("invents no counts: every count it states is one the data holds", async () => {
    const md = reportMarkdown(await report(), ORIGIN);
    expect(md).toContain("across 2 fixtures");
    expect(md.match(/^\| \d+ \| /gm)).toHaveLength(4);
    expect(md).not.toMatch(/Ampere|Graviton|Neoverse/);
    expect(md).not.toMatch(/\b[0-9a-f]{40}\b/);
  });
});

describe("historyMarkdown", () => {
  it("states the window and units, and keeps only the tools asked for", async () => {
    const md = historyMarkdown(historyOf(await report(), ["bun", "npm"]), ORIGIN);
    expect(md).toContain("- Values: seconds");
    expect(md).toContain("date,bun,npm\n2026-10-10,2.4,24\n2026-10-11,,\n2026-10-12,2.2,\n");
    expect(md).not.toContain("vlt 1.0.0 → 1.1.0");
  });

  it("labels a derived metric as derived", async () => {
    const md = historyMarkdown(historyOf(await report("metric=change"), ["bun"]), ORIGIN);
    expect(md).toContain("(derived from total time)");
  });
});

describe("tocOf", () => {
  it("anchors the About page's headings where the footer links to them", () => {
    expect(tocOf(mdxSource("app/about/content.mdx"))).toEqual([
      { title: "Set up your agent", url: "#set-up-your-agent", depth: 2 },
      { title: "Latest results", url: "#latest-results", depth: 2 },
    ]);
  });
});
