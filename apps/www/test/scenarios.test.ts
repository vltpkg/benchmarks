import { describe, expect, it } from "vitest";
import { sectionOf, SECTION_DEFS } from "../src/lib/sections.ts";
import {
  scenarioKind,
  scenarioPath,
  scenarioState,
  scenariosFor,
  situationOf,
  stateParts,
  uncuratedOf,
} from "../src/lib/scenarios.ts";
import { buildOutline } from "../src/lib/outline.ts";
import { citation, citeFor } from "../src/lib/cite.ts";
import {
  byFixture,
  countRows,
  meanByTool,
  perPackageByFixture,
  unranked,
  usable,
} from "../src/lib/measurements.ts";
import { markersForTools, versionMarkers } from "../src/lib/version-markers.ts";
import {
  loadReportParams,
  reportHref,
  tableSortOf,
  trendWindow,
  withTableSort,
} from "../src/lib/params.ts";

describe("sectionOf", () => {
  it("files registry variations under registries", () => {
    expect(sectionOf("registry-clean")).toBe("registries");
    expect(sectionOf("registry-lockfile")).toBe("registries");
  });

  it("files script variations under task-runners", () => {
    expect(sectionOf("build")).toBe("task-runners");
    expect(sectionOf("build-cache")).toBe("task-runners");
    expect(sectionOf("run")).toBe("task-runners");
  });

  it("files install variations under package-managers", () => {
    expect(sectionOf("clean")).toBe("package-managers");
    expect(sectionOf("cache+lockfile+node_modules")).toBe("package-managers");
  });

  it("files a variation nobody has curated, without being edited", () => {
    // The whole reason this is a rule and not a lookup table.
    expect(sectionOf("ci+setup")).toBe("package-managers");
    expect(sectionOf("something-new")).toBe("package-managers");
  });
});

describe("scenarioState", () => {
  it("reads the compound name", () => {
    expect(scenarioState("clean")).toEqual({ cache: false, lockfile: false, nodeModules: false });
    expect(scenarioState("cache")).toEqual({ cache: true, lockfile: false, nodeModules: false });
    expect(scenarioState("cache+lockfile+node_modules")).toEqual({
      cache: true,
      lockfile: true,
      nodeModules: true,
    });
    expect(scenarioState("lockfile+node_modules")).toEqual({
      cache: false,
      lockfile: true,
      nodeModules: true,
    });
  });

  it("treats ci as implying a lockfile, which the name does not say", () => {
    expect(scenarioState("ci")).toEqual({ cache: false, lockfile: true, nodeModules: false });
    expect(scenarioState("ci+setup")).toEqual({ cache: false, lockfile: true, nodeModules: false });
  });
});

describe("scenarioKind", () => {
  const kind = (v: string) => scenarioKind(v, scenarioState(v));

  it("labels the ends and the middle", () => {
    expect(kind("clean")).toBe("cold");
    expect(kind("cache+lockfile+node_modules")).toBe("warm");
    expect(kind("cache")).toBe("partial");
    expect(kind("lockfile+node_modules")).toBe("partial");
  });

  it("labels the ci family", () => {
    expect(kind("ci")).toBe("ci");
    expect(kind("ci+setup")).toBe("ci");
  });

  it("does not describe non-install scenarios in cache terms", () => {
    expect(kind("registry-clean")).toBe("other");
    expect(kind("build")).toBe("other");
    expect(kind("run")).toBe("other");
  });
});

describe("scenariosFor", () => {
  const published = [
    "cache",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "cache+node_modules",
    "ci",
    "clean",
    "lockfile",
    "lockfile+node_modules",
    "node_modules",
    "registry-clean",
    "registry-lockfile",
    "build",
    "build-cache",
    "run",
  ];

  it("returns the curated order, not alphabetical or published order", () => {
    expect(scenariosFor("package-managers", published).map((s) => s.variation)).toEqual([
      ...SECTION_DEFS["package-managers"].order,
    ]);
  });

  it("keeps only this section's variations", () => {
    expect(scenariosFor("registries", published).map((s) => s.variation)).toEqual([
      "registry-clean",
      "registry-lockfile",
    ]);
    expect(scenariosFor("task-runners", published).map((s) => s.variation)).toEqual([
      "build",
      "build-cache",
      "run",
    ]);
  });

  it("omits a curated scenario the date did not publish", () => {
    const sparse = ["clean", "ci"];
    expect(scenariosFor("package-managers", sparse).map((s) => s.variation)).toEqual([
      "clean",
      "ci",
    ]);
  });

  it("SURFACES a published scenario nobody curated, rather than dropping it", () => {
    const withNew = [...published, "ci+setup"];
    const result = scenariosFor("package-managers", withNew);
    expect(result.map((s) => s.variation)).toContain("ci+setup");
    expect(uncuratedOf(result).map((s) => s.variation)).toEqual(["ci+setup"]);
  });

  it("puts uncurated scenarios after the curated ones", () => {
    const result = scenariosFor("package-managers", [...published, "ci+setup", "aaa-new"]);
    const names = result.map((s) => s.variation);
    expect(names.indexOf("aaa-new")).toBeGreaterThan(names.indexOf("ci"));
    expect(names.slice(-2)).toEqual(["aaa-new", "ci+setup"]);
  });

  it("returns nothing when the date published nothing for this section", () => {
    // 2026-04-14: 49 benchmark files, zero of them registry-*, while its
    // chart-data.json advertises both registry sections with populated rows.
    const noRegistries = published.filter((v) => !v.startsWith("registry-"));
    expect(scenariosFor("registries", noRegistries)).toEqual([]);
  });

  it("deduplicates", () => {
    expect(scenariosFor("registries", ["registry-clean", "registry-clean"])).toHaveLength(1);
  });
});

describe("buildOutline", () => {
  const base = {
    fixtures: ["next", "astro", "svelte", "vue", "large", "babylon"],
    packageCountFixtures: ["next", "astro", "svelte", "vue", "large", "babylon"],
    processCountFixtures: ["next", "astro", "svelte", "vue", "large", "babylon"],
    isScript: false,
  };

  it("builds the four sections for an ordinary install scenario", () => {
    expect(buildOutline(base).map((s) => s.id)).toEqual([
      "leaderboard",
      "time",
      "per-package",
      "footprint",
    ]);
  });

  it("drops spawned processes when the variation publishes no process-count", () => {
    // Every registry-* variation. Verified across the archive.
    const outline = buildOutline({ ...base, processCountFixtures: [] });
    expect(outline.map((s) => s.id)).toEqual(["leaderboard", "time", "per-package", "footprint"]);
    const footprint = outline.find((s) => s.id === "footprint");
    expect(footprint?.items.map((i) => i.id)).toEqual(["package-count"]);
  });

  it("drops both footprint tables and per-package for a script scenario", () => {
    // build, build-cache and run publish NEITHER sibling file.
    const outline = buildOutline({
      ...base,
      packageCountFixtures: [],
      processCountFixtures: [],
      isScript: true,
    });
    expect(outline.map((s) => s.id)).toEqual(["leaderboard", "time"]);
    expect(outline[1]?.title).toBe("Execution time");
  });

  it("returns nothing when the scenario published no benchmark files", () => {
    expect(buildOutline({ ...base, fixtures: [] })).toEqual([]);
  });

  it("puts the trend, the trend cards, the bars and the table under time", () => {
    const time = buildOutline(base).find((s) => s.id === "time");
    expect(time?.items.map((i) => i.id)).toEqual([
      "time-trend",
      "trend-by-tool",
      "time-bars",
      "time-by-fixture",
      "time-table",
    ]);
  });
});

describe("failed runs are reported but never measured", () => {
  // The real case: zpm on babylon, 2026-10-02 -- mean 0.000s, exit_codes [1].
  // Averaged in, it put a tool that crashed on the largest fixture first.
  const ok = (command: string, mean: number) => ({
    command,
    mean,
    stddev: 0.01,
    median: mean,
    min: mean,
    max: mean,
    user: 0,
    system: 0,
    times: [mean],
    exit_codes: [0],
  });
  const crashed = (command: string) => ({ ...ok(command, 0), exit_codes: [1] });

  const files = [
    { fixture: "astro", file: { results: [ok("zpm", 0.53), ok("npm", 2.0)] } },
    { fixture: "babylon", file: { results: [crashed("zpm"), ok("npm", 4.0)] } },
  ];
  const tools = ["zpm", "npm"];

  it("excludes the crashed run from the mean", () => {
    const means = meanByTool(files, tools);
    const zpm = means.find((m) => m.tool === "zpm");
    expect(zpm?.mean).toBeCloseTo(0.53, 5); // not (0.53 + 0) / 2
    expect(zpm?.fixtures).toBe(1);
  });

  it("names the crashed run on its fixture, apart from the values", () => {
    // So a table can print DNF. Without this a crash and a tool that was
    // never scheduled are the same blank cell.
    const babylon = byFixture(files, tools).find((r) => r.fixture === "babylon");
    expect(babylon?.failed).toEqual(["zpm"]);
    expect(babylon?.values.map((v) => v.tool)).not.toContain("zpm");
  });

  it("lists a tool that finished nowhere, which the ranking cannot hold", () => {
    // The real case: nx on next-build, 2026-10-13 -- mean 0, exit_codes [1],
    // its only fixture. meanByTool has nothing to average and drops it.
    const only = [{ fixture: "next", file: { results: [crashed("nx"), ok("npm", 16.7)] } }];
    expect(meanByTool(only, ["nx", "npm"]).map((m) => m.tool)).toEqual(["npm"]);
    expect(unranked(only, ["nx", "npm"])).toEqual(["nx"]);
    // A tool that finished somewhere is ranked, so it is not listed here.
    expect(unranked(files, tools)).toEqual([]);
  });

  it("carries a package-count range only when it is a range", () => {
    const rows = countRows(
      [
        { fixture: "next", counts: { berry: { count: 336, minCount: 335, maxCount: 337 } } },
        { fixture: "vue", counts: { berry: { count: 100, minCount: 100, maxCount: 100 } } },
      ],
      ["berry"],
    );
    expect(rows[0]?.ranges).toEqual({ next: [335, 337] });
    expect(rows[0]?.total).toBe(436);
  });

  it("still reports that it failed", () => {
    expect(meanByTool(files, tools).find((m) => m.tool === "zpm")?.failed).toBe(true);
  });

  it("does not rank a crashed tool ahead of one that completed", () => {
    // With the zero averaged in, zpm's mean was 0.265 and it sorted first.
    const means = meanByTool(files, tools);
    const zpm = means.find((m) => m.tool === "zpm")!;
    const npm = means.find((m) => m.tool === "npm")!;
    expect(zpm.mean).toBeGreaterThan(0);
    expect(npm.mean).toBeCloseTo(3.0, 5);
  });

  it("drops a tool whose every run failed, rather than showing it at zero", () => {
    const allBad = [{ fixture: "astro", file: { results: [crashed("zpm")] } }];
    expect(meanByTool(allBad, ["zpm"])).toEqual([]);
  });

  it("keeps the crashed point out of the dot plot", () => {
    const rows = byFixture(files, tools);
    expect(rows.find((r) => r.fixture === "babylon")?.values.map((v) => v.tool)).toEqual(["npm"]);
  });

  it("keeps the crashed point out of per-package time", () => {
    const rows = perPackageByFixture(
      files.map((f) => ({ ...f, counts: { zpm: { count: 100 }, npm: { count: 100 } } })),
      tools,
    );
    expect(rows.find((r) => r.fixture === "babylon")?.values.map((v) => v.tool)).toEqual(["npm"]);
  });
});

describe("usable", () => {
  const base = {
    command: "x",
    stddev: 0,
    median: 0,
    min: 0,
    max: 0,
    user: 0,
    system: 0,
    times: [1],
  };

  it("rejects a failing exit code", () => {
    expect(usable({ ...base, mean: 1, exit_codes: [1] })).toBe(false);
  });

  it("rejects a non-finite mean even when the exit code is clean", () => {
    // generate-chart.js:179 guards this on the derived path; the raw path
    // must too. No instances in the surveyed tree -- guarded anyway.
    expect(usable({ ...base, mean: Number.NaN, exit_codes: [0] })).toBe(false);
    expect(usable({ ...base, mean: Number.POSITIVE_INFINITY, exit_codes: [0] })).toBe(false);
  });

  it("accepts an ordinary result", () => {
    expect(usable({ ...base, mean: 1.5, exit_codes: [0, 0] })).toBe(true);
  });

  it("reports a non-finite result rather than dropping it silently", () => {
    const means = meanByTool(
      [
        {
          fixture: "astro",
          file: { results: [{ ...base, command: "zpm", mean: Number.NaN, exit_codes: [0] }] },
        },
      ],
      ["zpm"],
    );
    // No usable runs, so no row -- but if it had any, `failed` would be set.
    expect(means).toEqual([]);
  });

  it("marks a tool failed when one fixture is non-finite and another is fine", () => {
    const means = meanByTool(
      [
        {
          fixture: "astro",
          file: { results: [{ ...base, command: "zpm", mean: 2, exit_codes: [0] }] },
        },
        {
          fixture: "babylon",
          file: { results: [{ ...base, command: "zpm", mean: Number.NaN, exit_codes: [0] }] },
        },
      ],
      ["zpm"],
    );
    expect(means[0]?.mean).toBe(2);
    expect(means[0]?.fixtures).toBe(1);
    expect(means[0]?.failed).toBe(true);
  });
});

describe("versionMarkers", () => {
  it("reports a changed version on the date it is first observed", () => {
    const m = versionMarkers([
      { date: "2026-09-15", versions: { vlt: "1.0.10", npm: "12.0.2" } },
      { date: "2026-09-30", versions: { vlt: "1.3.2", npm: "12.0.2" } },
    ]);
    expect(m).toEqual([
      {
        date: "2026-09-30",
        tool: "vlt",
        kind: "changed",
        version: "1.3.2",
        previous: "1.0.10",
        label: "vlt 1.3.2",
      },
    ]);
  });

  it("reports a key first appearing as added", () => {
    const m = versionMarkers([
      { date: "2026-09-15", versions: { npm: "12.0.2" } },
      { date: "2026-09-30", versions: { npm: "12.0.2", upm: "1.3.1" } },
    ]);
    expect(m.map((x) => [x.tool, x.kind])).toEqual([["upm", "added"]]);
  });

  it("yields NO marker across a date with no versions.json", () => {
    // The start boundary. Comparing across the gap would report every tool as
    // added, which is the file appearing rather than anything happening.
    const m = versionMarkers([
      { date: "2025-08-22", versions: null },
      { date: "2025-09-02", versions: { npm: "11.0.0", vlt: "0.1.0" } },
    ]);
    expect(m).toEqual([]);
  });

  it("resumes once two consecutive dates both have the file", () => {
    const m = versionMarkers([
      { date: "2025-08-22", versions: null },
      { date: "2025-09-02", versions: { npm: "11.0.0" } },
      { date: "2025-09-03", versions: { npm: "11.1.0" } },
    ]);
    expect(m.map((x) => x.label)).toEqual(["npm 11.1.0"]);
  });

  it("never emits a marker without a version string", () => {
    const m = versionMarkers([
      { date: "a", versions: { npm: "1" } },
      { date: "b", versions: { npm: undefined } },
    ]);
    expect(m).toEqual([]);
  });

  it("filters to the compared tools", () => {
    const all = versionMarkers([
      { date: "a", versions: { npm: "1", zpm: "1" } },
      { date: "b", versions: { npm: "2", zpm: "2" } },
    ]);
    expect(markersForTools(all, ["npm"]).map((m) => m.tool)).toEqual(["npm"]);
  });
});

describe("versionMarkers · the empty-version case", () => {
  it("treats an empty previous value as a first observation, not a change", () => {
    // Real: upm is absent 2026-09-15, "" on 2026-09-29, "1.3.1" on 2026-09-30.
    const m = versionMarkers([
      { date: "2026-09-29", versions: { upm: "" } },
      { date: "2026-09-30", versions: { upm: "1.3.1" } },
    ]);
    expect(m).toEqual([
      {
        date: "2026-09-30",
        tool: "upm",
        kind: "added",
        version: "1.3.1",
        label: "upm added 1.3.1",
      },
    ]);
    expect(m[0]).not.toHaveProperty("previous");
  });

  it("emits nothing while the version is still empty", () => {
    const m = versionMarkers([
      { date: "2026-09-15", versions: {} },
      { date: "2026-09-29", versions: { upm: "" } },
    ]);
    expect(m).toEqual([]);
  });
});

describe("the trend window", () => {
  // Published dates either side of the archive's widest gap.
  const dates = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-29", "2026-06-30"];
  const base = { dates, end: "2026-06-30", range: 30, from: null, to: null };

  it("a preset is that many calendar days ending at the run shown", () => {
    const w = trendWindow({ ...base, range: 30 });
    expect(w.custom).toBe(false);
    expect(w.dates).toEqual(dates);
    expect(w.to).toBe("2026-06-30");
    // Fourteen days back from Jun 30 reaches Jun 17 and no further.
    expect(trendWindow({ ...base, range: 14 }).dates).toEqual([
      "2026-06-17",
      "2026-06-29",
      "2026-06-30",
    ]);
  });

  it("honours an exact range whose ends are both published dates", () => {
    const w = trendWindow({ ...base, from: "2026-06-16", to: "2026-06-29" });
    expect(w).toEqual({
      custom: true,
      from: "2026-06-16",
      to: "2026-06-29",
      dates: ["2026-06-16", "2026-06-17", "2026-06-29"],
    });
  });

  it("will not start or end a range on a day with no published run", () => {
    // Jun 20 and Jun 25 are inside the eleven-day gap.
    expect(trendWindow({ ...base, from: "2026-06-20", to: "2026-06-30" }).custom).toBe(false);
    expect(trendWindow({ ...base, from: "2026-06-15", to: "2026-06-25" }).custom).toBe(false);
  });

  it("falls back to the preset for a reversed, half-given or over-long range", () => {
    expect(trendWindow({ ...base, from: "2026-06-30", to: "2026-06-15" }).custom).toBe(false);
    expect(trendWindow({ ...base, from: "2026-06-15", to: null }).custom).toBe(false);
    const long = ["2026-01-01", ...dates];
    expect(trendWindow({ ...base, dates: long, from: "2026-01-01", to: "2026-06-30" }).custom).toBe(
      false,
    );
  });

  it("will not run past the run the report is showing", () => {
    expect(
      trendWindow({ ...base, end: "2026-06-17", from: "2026-06-15", to: "2026-06-30" }).custom,
    ).toBe(false);
    expect(trendWindow({ ...base, end: "2026-06-17" }).dates).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
    ]);
  });
});

describe("query parameters", () => {
  it("a report link carries only what differs from the defaults", () => {
    expect(
      reportHref("/package-managers/clean", {
        date: null,
        fixture: null,
        range: 30,
        from: null,
        to: null,
        hide: [],
        scale: "linear",
        sort: [],
      }),
    ).toBe("/package-managers/clean");
    expect(reportHref("/registries/registry-clean", { fixture: "astro", range: 90 })).toBe(
      "/registries/registry-clean?fixture=astro&range=90",
    );
  });

  it("a malformed value falls back to the default instead of erroring", async () => {
    const q = await loadReportParams(new URLSearchParams("range=7&scale=sideways&hide="));
    expect(q.range).toBe(30);
    expect(q.scale).toBe("linear");
    expect(q.hide).toEqual([]);
  });

  it("reads one table's sort out of the entries, by table id", () => {
    const entries = ["time.astro.desc", "ranking.mean.asc"];
    expect(tableSortOf(entries, "time", ["tool", "astro"])).toEqual({
      column: "astro",
      direction: "desc",
    });
    expect(tableSortOf(entries, "ranking", ["mean"])).toEqual({ column: "mean", direction: "asc" });
    expect(tableSortOf(entries, "packages", ["total"])).toBeNull();
  });

  it("ignores a column the table does not have, and a direction that is neither", () => {
    // Fixtures are discovered from the data; a link can name one this
    // scenario never published.
    expect(tableSortOf(["time.ghost.asc"], "time", ["tool", "astro"])).toBeNull();
    expect(tableSortOf(["time.astro.sideways"], "time", ["tool", "astro"])).toBeNull();
    expect(tableSortOf(["time.astro"], "time", ["tool", "astro"])).toBeNull();
  });

  it("does not mistake one table's entry for another whose id it starts with", () => {
    expect(tableSortOf(["timeline.astro.asc"], "time", ["astro"])).toBeNull();
    expect(tableSortOf(["per-package.astro.asc"], "per", ["astro"])).toBeNull();
  });

  it("allows a column id with a dot in it, since fixture names are not ours to choose", () => {
    expect(tableSortOf(["time.next.js.asc"], "time", ["next.js"])).toEqual({
      column: "next.js",
      direction: "asc",
    });
  });

  it("replaces only its own table's entry, and removes it for the default order", () => {
    const entries = ["time.astro.desc", "ranking.mean.asc"];
    expect(withTableSort(entries, "time", { column: "vue", direction: "asc" })).toEqual([
      "ranking.mean.asc",
      "time.vue.asc",
    ]);
    expect(withTableSort(entries, "time", null)).toEqual(["ranking.mean.asc"]);
  });
});

describe("the citation", () => {
  const cite = {
    title: "vlt benchmarks: Package managers, clean",
    date: "2026-10-13",
    note: "Run of 2026-10-13; results regenerate nightly.",
  };
  const url = "https://example.test/package-managers/clean?date=2026-10-13";

  it("cites a run by its date, in each format", () => {
    expect(citation("url", cite, url)).toBe(url);
    expect(citation("apa", cite, url)).toBe(
      `vlt technology inc. (2026, October 13). vlt benchmarks: Package managers, clean [Data set]. ${url}`,
    );
    const bibtex = citation("bibtex", cite, url);
    expect(bibtex).toContain("@misc{vlt-benchmarks-2026-10-13,");
    expect(bibtex).toContain("year   = {2026},");
    expect(bibtex).toContain("month  = oct,");
    expect(bibtex).toContain(`url    = {${url}}`);
  });

  it("claims no year where the page is about no single run", () => {
    const site = { title: "vlt benchmarks", date: null, note: "Nightly." };
    expect(citation("apa", site, "https://example.test/")).toContain("(n.d.)");
    expect(citation("bibtex", site, "https://example.test/")).not.toMatch(/year|month/);
  });

  it("names the run, its date and the cadence, and claims no counts", () => {
    const run = citeFor({ benchmark: "Package managers", scenario: "clean", date: "2026-10-13" });
    expect(run).toEqual({
      title: "vlt benchmarks: Package managers, clean",
      date: "2026-10-13",
      note: "Run of 2026-10-13; results regenerate nightly on GitHub-hosted ubuntu-24.04-arm runners.",
    });
    expect(run.note).not.toMatch(/tool|fixture|scenario|baseline/);
    expect(citeFor(null)).toEqual({
      title: "vlt benchmarks",
      date: null,
      note: "Results regenerate nightly on GitHub-hosted ubuntu-24.04-arm runners.",
    });
  });
});

describe("the sidebar's grouping and paths", () => {
  it("files package-manager scenarios under Cold, Warm and CI, uncurated last under CI", () => {
    const list = scenariosFor("package-managers", [
      "ci+setup",
      "clean",
      "cache",
      "cache+lockfile+node_modules",
      "ci",
    ]);
    expect(list.map((s) => [s.variation, situationOf(s)])).toEqual([
      ["clean", "Cold"],
      ["cache", "Warm"],
      ["cache+lockfile+node_modules", "Warm"],
      ["ci", "CI"],
      ["ci+setup", "CI"],
    ]);
  });

  it("does not group what encodes no disk state", () => {
    for (const s of scenariosFor("registries", ["registry-clean", "registry-lockfile"])) {
      expect(situationOf(s)).toBeNull();
    }
  });

  it("encodes a compound name in its path", () => {
    expect(scenarioPath("package-managers", "cache+lockfile")).toBe(
      "/package-managers/cache%2Blockfile",
    );
  });

  it("words the state as the picker did", () => {
    expect(stateParts(scenarioState("ci")).map((p) => `${p.name} ${p.word}`)).toEqual([
      "binary preinstalled",
      "cache empty",
      "lockfile present",
      "node_modules removed",
    ]);
  });
});
