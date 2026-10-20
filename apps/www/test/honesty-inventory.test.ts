/**
 * THE HONESTY INVENTORY.
 *
 * One named test per behaviour that must survive the EvilCharts retrofit.
 * The acceptance criterion for the retrofit is this file still passing, not
 * "the charts render" — a connected line through a gap looks better, not
 * broken, which is exactly why eyeballing is not evidence.
 *
 * Numbering matches the planner's baseline extracted from charts.tsx, extended
 * where that list was incomplete.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alignedSeries,
  gappedPath,
  niceTicks,
  segments,
  spreadOf,
  toChartRows,
  toDenseChartRows,
} from "../src/lib/chart-model.ts";
import { PACKAGE_MANAGERS, usable, type ToolMean } from "../src/lib/measurements.ts";
import { findingFor, formatRatio, formatVersus } from "../src/lib/findings.ts";
import {
  bridges,
  fixtureBars,
  loneRuns,
  meanBars,
  nearestRun,
  windowChange,
} from "../src/lib/figures.ts";
import { baselineOf, toolLabel } from "../src/lib/tools.ts";
import { versionMarkers, versionNote } from "../src/lib/version-markers.ts";
import { trendPoint } from "../src/lib/load.ts";

const x = (i: number) => i * 10;
const y = (v: number) => 100 - v;

describe("inventory 1 · a line breaks at a gap rather than drawing through it", () => {
  it("emits one segment per contiguous run", () => {
    expect(segments([1, 2, undefined, 4, 5])).toEqual([
      { from: 0, to: 1 },
      { from: 3, to: 4 },
    ]);
  });

  it("starts each run with M, so nothing is drawn across the hole", () => {
    const d = gappedPath([1, 2, undefined, 4], x, y);
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d).toBe("M0.0,99.0 L10.0,98.0 M30.0,96.0");
  });

  it("the real 11-day gap produces two segments, not one line", () => {
    // 2026-06-17 -> 2026-06-29 are CONSECUTIVE published dates with 11 missing
    // calendar days between them. A renderer that connects them is wrong and
    // looks right.
    const beforeAfter = [5.1, 5.2, undefined, 5.0];
    expect(segments(beforeAfter)).toHaveLength(2);
  });
});

describe("inventory 2 · non-finite values count as absent", () => {
  it("NaN and Infinity break the line like a missing value", () => {
    expect(segments([1, Number.NaN, 3])).toEqual([
      { from: 0, to: 0 },
      { from: 2, to: 2 },
    ]);
    expect(segments([1, Number.POSITIVE_INFINITY, 3])).toHaveLength(2);
  });
});

describe("inventory 3 · the scale guards a non-positive maximum", () => {
  it("returns a single zero tick rather than Infinity steps", () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(-5)).toEqual([0]);
    expect(niceTicks(Number.NaN)).toEqual([0]);
  });

  it("still produces real ticks for a real maximum", () => {
    expect(niceTicks(10).at(-1)).toBeGreaterThanOrEqual(10);
  });
});

describe("inventory 4 · an empty slot means 'no value for this run'", () => {
  it("keeps one slot per published run, holes included", () => {
    const points = [
      { date: "d1", byTool: { npm: 1 } },
      { date: "d2", byTool: {} },
      { date: "d3", byTool: { npm: 3 } },
    ];
    expect(alignedSeries(points, "npm")).toEqual([1, undefined, 3]);
  });
});

describe("inventory 5 · an all-empty series renders nothing, not an invalid element", () => {
  it("produces an empty path rather than one starting with L", () => {
    expect(gappedPath([undefined, undefined], x, y)).toBe("");
  });

  it("a series whose FIRST slot is empty still starts with M", () => {
    // The actual bug: this emitted "L..." — invalid SVG, silently dropped,
    // which reads as "this tool has no data".
    const d = gappedPath([undefined, 2, 3], x, y);
    expect(d.startsWith("M")).toBe(true);
    expect(d).toBe("M10.0,98.0 L20.0,97.0");
  });
});

describe("inventory 6 · fastest and slowest handle an empty row", () => {
  it("returns nulls rather than undefined reads", () => {
    expect(spreadOf([])).toEqual({ fastest: null, slowest: null, ratio: null });
  });

  it("ignores non-positive and non-finite values", () => {
    const s = spreadOf([
      { tool: "a", value: 0 },
      { tool: "b", value: Number.NaN },
      { tool: "c", value: 2 },
    ]);
    expect(s.fastest?.tool).toBe("c");
    expect(s.slowest?.tool).toBe("c");
  });
});

describe("inventory 7 · spread is null when it cannot be computed", () => {
  it("does not report 1x for a single tool", () => {
    expect(spreadOf([{ tool: "a", value: 3 }]).ratio).toBe(1);
  });

  it("is null with nothing usable", () => {
    expect(spreadOf([{ tool: "a", value: 0 }]).ratio).toBeNull();
  });
});

describe("inventory 9 · the failed-run sentinel is excluded from every figure", () => {
  const base = {
    command: "x",
    stddev: 0,
    median: 0,
    min: 0,
    max: 0,
    user: 0,
    system: 0,
    times: [0],
  };

  it("rejects clean-benchmarks.js's total-failure stamp", () => {
    // clean-benchmarks.js:115-125 writes times=[0], exit_codes=[1], mean=0.
    expect(usable({ ...base, mean: 0, exit_codes: [1] })).toBe(false);
  });

  it("rejects a non-finite mean with a clean exit", () => {
    expect(usable({ ...base, mean: Number.NaN, exit_codes: [0] })).toBe(false);
  });

  it("accepts a genuine zero-exit measurement", () => {
    expect(usable({ ...base, mean: 1.5, exit_codes: [0, 0] })).toBe(true);
  });
});

describe("inventory 10 · x-positions align to dates and are never compacted", () => {
  it("a hole keeps its slot, so later runs do not slide left", () => {
    const points = [
      { date: "2026-06-17", byTool: { npm: 5 } },
      { date: "2026-06-29", byTool: {} },
      { date: "2026-06-30", byTool: { npm: 7 } },
    ];
    const series = alignedSeries(points, "npm");
    expect(series).toHaveLength(points.length);
    // The last run sits at index 2, not index 1.
    expect(series[2]).toBe(7);
  });
});

describe("inventory 11 · engine rows carry holes as null, never as zero", () => {
  it("emits null for an absent value", () => {
    const rows = toChartRows(
      [
        { date: "d1", byTool: { npm: 1 } },
        { date: "d2", byTool: {} },
      ],
      ["npm"],
    );
    expect(rows).toEqual([
      { date: "d1", npm: 1 },
      { date: "d2", npm: null },
    ]);
  });

  it("never substitutes 0, which a chart would plot as a measurement", () => {
    const rows = toChartRows([{ date: "d", byTool: { npm: Number.NaN } }], ["npm"]);
    expect(rows[0]?.["npm"]).toBeNull();
    expect(rows[0]?.["npm"]).not.toBe(0);
  });

  it("keeps one row per published date", () => {
    const points = [
      { date: "a", byTool: {} },
      { date: "b", byTool: {} },
    ];
    expect(toChartRows(points, ["npm"])).toHaveLength(2);
  });
});

describe("inventory 12 · a calendar gap is a real hole, not an equal step", () => {
  const points = [
    { date: "2026-06-17", byTool: { npm: 5 } },
    { date: "2026-06-29", byTool: { npm: 6 } },
  ];

  it("emits one row per calendar day, so the 11 missing days exist", () => {
    // Both dates HAVE values, so nothing is null at the published-date level.
    // On an ordinal axis they sit one step apart and eleven absent days vanish.
    const { rows, dense } = toDenseChartRows(points, ["npm"]);
    expect(dense).toBe(true);
    expect(rows).toHaveLength(13); // 06-17 .. 06-29 inclusive
    expect(rows[0]?.["npm"]).toBe(5);
    expect(rows.at(-1)?.["npm"]).toBe(6);
  });

  it("the eleven days between carry null, which is what breaks the line", () => {
    const { rows } = toDenseChartRows(points, ["npm"]);
    const middle = rows.slice(1, -1);
    expect(middle).toHaveLength(11);
    expect(middle.every((r) => r["npm"] === null)).toBe(true);
  });

  it("segments see two runs, not one", () => {
    const { rows } = toDenseChartRows(points, ["npm"]);
    const series = rows.map((r) => (typeof r["npm"] === "number" ? r["npm"] : undefined));
    expect(segments(series)).toEqual([
      { from: 0, to: 0 },
      { from: 12, to: 12 },
    ]);
  });

  it("consecutive days stay adjacent, with no phantom rows", () => {
    const { rows } = toDenseChartRows(
      [
        { date: "2026-06-16", byTool: { npm: 1 } },
        { date: "2026-06-17", byTool: { npm: 2 } },
      ],
      ["npm"],
    );
    expect(rows).toHaveLength(2);
  });

  it("falls back rather than emitting 700 rows for a two-year window, and says so", () => {
    const { dense, spanDays, rows } = toDenseChartRows(
      [
        { date: "2025-08-22", byTool: { npm: 1 } },
        { date: "2026-06-29", byTool: { npm: 2 } },
      ],
      ["npm"],
    );
    expect(dense).toBe(false);
    expect(spanDays).toBeGreaterThan(300);
    expect(rows).toHaveLength(2);
  });
});

describe("inventory 13 · the tested helpers are the RENDERED helpers", () => {
  /*
   * The failure this guards against was real and self-inflicted: the inventory
   * passed while `charts.tsx` carried its own private copies of `gappedPath`,
   * `niceTicks` and the fastest/slowest logic. Every test was green against
   * code nothing rendered.
   *
   * It is the same shape as the baseline inventory's own item 10, which
   * described an intention the axis did not implement. A list can carry an
   * aspiration as though it were a behaviour; so can a test suite, if it tests
   * a parallel implementation.
   */
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("no chart component defines its own copy of a honesty helper", () => {
    for (const file of [
      "../src/components/charts-echarts-dots.tsx",
      "../src/components/charts-figures.tsx",
      "../src/components/sections.tsx",
    ]) {
      const src = read(file);
      expect(src, `${file} must not redefine gappedPath`).not.toMatch(/const gappedPath\s*=/);
      expect(src, `${file} must not redefine niceTicks`).not.toMatch(/const niceTicks\s*=/);
      expect(src, `${file} must not redefine spreadOf`).not.toMatch(/const spreadOf\s*=/);
    }
  });

  it("no hand-built chart implementation survives alongside the retrofitted one", () => {
    // The retrofit is only complete when the old implementation is GONE. A dead
    // parallel chart module is the same hazard as a duplicated helper: it
    // cannot fail a test, and it can be imported again by accident.
    expect(existsSync(new URL("../src/components/charts.tsx", import.meta.url))).toBe(false);
    // And the Recharts migration, discarded when the engine ruling landed.
    expect(existsSync(new URL("../src/components/charts-recharts.tsx", import.meta.url))).toBe(
      false,
    );
  });
});

describe("inventory 14 · the categorical palette actually resolves", () => {
  /*
   * Found twice, the second time by this test being wrong.
   *
   * Tailwind 4 TREE-SHAKES `@theme` variables that no utility class
   * references. The tool colours are only ever read as `var(--color-tool-*)`
   * from inline styles and SVG fills, never as `bg-tool-npm`, so the emitted
   * stylesheet dropped them and ten of eleven tools fell back to one grey.
   *
   * The first version of this test blamed RAW VALUES and blessed a
   * `@theme inline` MAPPING as safe, on the theory that `inline` keeps the
   * `var()` reference. It does keep the reference — and then shakes the whole
   * declaration anyway, because nothing references the MAPPED name either.
   * Measured in the built CSS after the vltpkg token port:
   *
   *     --color-tool-* emitted: 1 of 20   (only `npm`, matched by chance)
   *     --tool-* raw emitted:  20 of 20
   *
   * So the invariant is about the CONSUMED NAME, not about raw values:
   * `--color-tool-X` — the exact string `toolColor()` puts inside `var()` —
   * must be declared in a plain, always-emitted selector block. `@theme` may
   * not be the only place it exists, in either form.
   */
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const themeBlocks = [...css.matchAll(/@theme(?: inline)?\s*\{([\s\S]*?)\n\}/g)]
    .map((m) => m[1] ?? "")
    .join("\n");
  const plainBlock = (selector: string) => {
    const re = new RegExp(`(?:^|\\n)${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, "g");
    return [...css.matchAll(re)].map((m) => m[1] ?? "").join("\n");
  };
  const light = plainBlock(":root");
  const dark = plainBlock('\\[data-theme="dark"\\]');

  it("declares the consumed --color-tool-* name in a plain always-emitted block", () => {
    for (const tool of PACKAGE_MANAGERS) {
      expect(light, `--color-tool-${tool} must be declared in a plain :root block`).toMatch(
        new RegExp(`--color-tool-${tool}:`),
      );
    }
  });

  it("overrides the same consumed names for dark, rather than only the raw values", () => {
    for (const tool of PACKAGE_MANAGERS) {
      expect(dark, `--color-tool-${tool} must be overridden for dark`).toMatch(
        new RegExp(`--color-tool-${tool}:`),
      );
    }
  });

  it("never leaves a tool colour reachable only through @theme", () => {
    const inTheme = new Set(
      [...themeBlocks.matchAll(/--(?:color-)?tool-([a-z0-9]+):/g)].map((m) => m[1] ?? ""),
    );
    const inPlain = new Set(
      [...`${light}\n${dark}`.matchAll(/--color-tool-([a-z0-9]+):/g)].map((m) => m[1] ?? ""),
    );
    const orphans = [...inTheme].filter((tool) => !inPlain.has(tool));
    expect(orphans, "these tools would be tree-shaken out of the build").toEqual([]);
  });

  it("gives each tool its own value, so the palette is categorical", () => {
    const valueOf = (block: string, tool: string) =>
      block.match(new RegExp(`--color-tool-${tool}:\\s*([^;]+);`))?.[1]?.trim();
    for (const scheme of [light, dark]) {
      const values = PACKAGE_MANAGERS.map((tool) => valueOf(scheme, tool));
      expect(values.every(Boolean)).toBe(true);
      expect(new Set(values).size).toBe(PACKAGE_MANAGERS.length);
    }
  });
});

describe("inventory 15 · the chart preset must not turn a missing run into zero", () => {
  /*
   * THE ENGINE SWAP'S HEADLINE FINDING, and the reason the planner required
   * this be verified on the real fixture rather than inherited from the
   * Recharts argument.
   *
   * The vendored EvilCharts ECharts line chart mapped every cell with
   * `Number(row[key]) || 0`. `Number(null)` is `0`, so a MISSING measurement
   * was plotted as ZERO — an absent run rendered as an instantaneous one, the
   * line dipped to the baseline, and `connectNulls: false` never fired because
   * no null survived to reach ECharts.
   *
   * It is the same class as the suite's total-failure sentinel (`mean: 0` for a
   * crashed run), which this app already excludes — reintroduced at the render
   * layer, where it would have drawn a flat zero across the eleven absent days
   * between 2026-06-17 and 2026-06-29 and called it a measurement.
   *
   * "Same default" is not "same semantics": Recharts and ECharts both default
   * connectNulls to false, and only one of them ever saw a null.
   */
  const vendored = readFileSync(
    new URL("../src/components/ui/echarts-line-chart.tsx", import.meta.url),
    "utf8",
  );

  it("does not coerce a cell to 0 before ECharts sees it", () => {
    expect(vendored).not.toMatch(/data\.map\(\(row\) => Number\(row\[key\]\)\s*\|\|\s*0\)/);
    expect(vendored).not.toMatch(/=\s*data\.map\(\(row\) => Number\(row\[key\]\)\s*\|\|\s*0\)/);
  });

  it("maps absent cells to null, which is what connectNulls acts on", () => {
    expect(vendored).toMatch(/const toSeriesValue[\s\S]*?return null;/);
    expect(vendored).toMatch(/data\.map\(\(row\) => toSeriesValue\(row\[key\]\)\)/);
  });

  it("every chart is forced onto the SVG renderer", () => {
    // The vendored component defaults to canvas, which is not assertable and
    // not reachable by assistive technology.
    const ts = readFileSync(
      new URL("../src/components/charts-echarts.tsx", import.meta.url),
      "utf8",
    );
    const dots = readFileSync(
      new URL("../src/components/charts-echarts-dots.tsx", import.meta.url),
      "utf8",
    );
    expect(ts).toMatch(/const RENDERER = "svg"/);
    expect(ts).toMatch(/renderer=\{RENDERER\}/);
    expect(dots.match(/renderer: "svg"/g) ?? []).toHaveLength(1);
  });

  it("the landing page draws a bar only for a tool that completed every fixture", () => {
    const page = readFileSync(new URL("../src/app/about/components.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/meanBars\(facts\.timeRows\)/);
  });
});

describe("inventory 8 · version changes are on the plot, and say only what was observed", () => {
  /*
   * This item was two captions under the time series: one saying a flat
   * stretch is absence, one counting version changes and pointing at a list
   * of them beneath the chart. Both are gone, with the list. A calendar gap
   * is still a break in the line (inventory 12); a version change is now a
   * ring on the tool's line at the run where it was first observed, and the
   * tooltip for any date carries each tool's version on it.
   *
   * What must survive the move: a mark is never drawn that the data does not
   * support, and the tooltip never states a version nobody published.
   */
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const series = read("../src/components/charts-echarts.tsx");
  const [changed, added] = versionMarkers([
    { date: "a", versions: { vlt: "1.3.6" } },
    { date: "b", versions: { vlt: "1.3.7", upm: "1.3.1" } },
  ]);

  it("writes a change out as from and to, and an addition as an addition", () => {
    expect(versionNote("1.3.7", changed)).toBe("1.3.6 → 1.3.7");
    expect(versionNote("1.3.1", added)).toBe("added 1.3.1");
  });

  it("states the version a tool ran, and nothing where none was published", () => {
    expect(versionNote("1.3.7")).toBe("1.3.7");
    // A date with no versions.json: no version carried forward from the day before.
    expect(versionNote(undefined)).toBe("");
  });

  it("draws a ring only where the tool has both a change and a measured run", () => {
    // A run with no value gets no ring -- at most a DNF cross on the lane.
    expect(series).toMatch(/if \(value === null\) \{[\s\S]{0,400}kind: "dnf"/);
    expect(series).toMatch(/changed\.has\(`\$\{tool\} \$\{row\.date\}`\)/);
    // The tooltip's wording is the tested function, not a copy of it.
    expect(series).toMatch(/versionNote\(versionsOn\.get\(date\)\?\.\[tool\], change\)/);
  });

  it("the registries section passes no versions: its keys name registries, not clients", () => {
    const report = read("../src/lib/report.ts");
    expect(report).toMatch(/hasVersions \? markersForTools\(/);
    expect(report).toMatch(/versions: hasVersions \? versionSeries : \[\]/);
    expect(read("../src/app/[section]/[[...params]]/page.tsx")).toMatch(
      /versions=\{trend\.versions\}/,
    );
  });

  it("nothing is written under the time series, and no list of changes survives", () => {
    expect(series).not.toMatch(/\bguide=/);
    expect(series).not.toMatch(/\bnotes=/);
    expect(
      existsSync(new URL("../src/components/version-markers-strip.tsx", import.meta.url)),
    ).toBe(false);
  });
});

describe("inventory 16 · dark mode is applied, not merely present", () => {
  /*
   * A theme system can be entirely correct and never reach the page.
   *
   * The palette is ported from the vltpkg docs, whose dark variant switches on
   * `[data-theme="dark"]`. next-themes defaults to toggling a CLASS. With the
   * default, every dark rule would sit in the stylesheet and never apply: no
   * error, no failed build, and a light-mode screenshot that looks perfect.
   *
   * Seventh instance of the repository's pattern — the artefact exists but does
   * not reach the thing it was meant to affect — and the one most likely to
   * pass a review, because reviews look at light mode.
   */
  const provider = readFileSync(
    new URL("../src/components/theme-provider.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  it("configures next-themes with the attribute the CSS actually switches on", () => {
    expect(provider).toMatch(/attribute="data-theme"/);
  });

  it("the dark variant targets that same attribute", () => {
    expect(css).toMatch(/@custom-variant dark \(&:where\(\[data-theme="dark"\]/);
  });

  it("the two never drift apart", () => {
    // The pair is the behaviour; either alone is inert.
    const attr = provider.match(/attribute="([^"]+)"/)?.[1];
    expect(attr).toBeDefined();
    expect(css).toContain(`[data-theme="dark"]`);
    expect(attr).toBe("data-theme");
  });

  it("dark overrides exist for the tokens the app actually reads", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const token of ["--background", "--foreground", "--border", "--brand", "--tool-npm"]) {
      expect(dark, `${token} needs a dark value`).toMatch(new RegExp(`\\${token}:`));
    }
  });

  it("the brand accent is NOT mapped onto shadcn's --accent", () => {
    // In a shadcn token set `accent` is the subtle hover SURFACE. Mapping a
    // brand colour onto it turns every component's hover state that colour.
    expect(css).toMatch(/--color-accent: var\(--accent\)/);
    expect(css).toMatch(/--color-brand: var\(--brand\)/);
  });
});

describe("inventory 17 · the headline sentence is true in every state", () => {
  /*
   * The hero of each page is "X is fastest at Ns, R× faster than npm." It is
   * the most quotable thing on the site, so it is the claim most worth
   * getting wrong on purpose here. Each test below is a state the published
   * data has been in or can be in.
   */
  const mean = (tool: string, value: number, extra: Partial<ToolMean> = {}): ToolMean => ({
    tool,
    mean: value,
    rsd: 0,
    fixtures: 2,
    failed: false,
    ...extra,
  });
  const rows = [
    {
      fixture: "a",
      failed: [],
      values: [
        { tool: "bun", value: 1 },
        { tool: "npm", value: 4 },
      ],
    },
    {
      fixture: "b",
      failed: [],
      values: [
        { tool: "bun", value: 3 },
        { tool: "npm", value: 2 },
      ],
    },
  ];
  const find = (
    means: ToolMean[],
    baseline: string | null = baselineOf(means.map((m) => m.tool)),
  ) => findingFor({ means, rows, fixtureCount: 2, baseline });

  it("states the fastest tool, its time and its ratio to the baseline", () => {
    const f = find([mean("bun", 4.22), mean("npm", 17.3)]);
    expect(f.sentence).toBe("bun is fastest at 4.22s, 4.1× faster than npm.");
    expect(f.marked).toBe("`bun` is fastest at 4.22s, 4.1× faster than `npm`.");
    expect(f.subject).toBe("bun");
    expect(f.ratio).toBeCloseTo(17.3 / 4.22, 6);
  });

  it("never crowns a tool that skipped or failed a fixture", () => {
    // The real case: zpm, 2026-10-13, clean -- lowest mean, 5 of 6 fixtures.
    const f = find([
      mean("zpm", 0.83, { fixtures: 1, failed: true }),
      mean("bun", 1.64),
      mean("npm", 26.9),
    ]);
    expect(f.subject).toBe("bun");
    expect(f.sentence).toMatch(/^bun is fastest/);
    expect(f.qualifier).toMatch(/zpm posted a lower mean but did not complete every fixture/);
  });

  it("says nothing about a partial tool that was slower anyway", () => {
    expect(
      find([mean("bun", 1.64), mean("zpm", 9, { fixtures: 1 }), mean("npm", 26.9)]).qualifier,
    ).toBeNull();
  });

  it("drops the ratio clause when the baseline was not measured", () => {
    const f = find([mean("bun", 1.64), mean("pnpm", 4.1)]);
    expect(f.sentence).toBe("bun is fastest at 1.64s.");
    expect(f.ratio).toBeNull();
  });

  it("drops the ratio clause when the baseline itself is partial", () => {
    const f = find([mean("bun", 1.64), mean("pnpm", 4.1), mean("npm", 26.9, { failed: true })]);
    expect(f.sentence).toBe("bun is fastest at 1.64s.");
    expect(f.ratio).toBeNull();
  });

  it("does not compare the baseline with itself", () => {
    const f = find([mean("npm", 16.7), mean("bun", 17.0)]);
    expect(f.sentence).toBe("npm, the baseline, is fastest at 16.7s.");
    expect(f.ratio).toBeNull();
  });

  it("calls a tie a tie, at the precision the page prints", () => {
    const f = find([mean("bun", 1.531), mean("zpm", 1.534), mean("npm", 15.3)]);
    expect(f.sentence).toBe("bun and zpm tie for fastest at 1.53s, 10.0× faster than npm.");
    expect(f.tiedWith).toEqual(["zpm"]);
  });

  it("does not say 'fastest' of a single tool", () => {
    const f = find([mean("bun", 1.64)]);
    expect(f.sentence).toBe("bun is the only tool that completed every fixture, at 1.64s.");
    expect(f.spread).toBeNull();
  });

  it("names nobody when nothing completed every fixture, or nothing ran", () => {
    const none = find([mean("zpm", 0.8, { failed: true }), mean("bun", 1.6, { fixtures: 1 })]);
    expect(none.subject).toBeNull();
    expect(none.sentence).toMatch(/none is ranked fastest/);
    expect(find([]).sentence).toBe("No completed runs were published for this scenario.");
    expect(find([]).subject).toBeNull();
  });

  it("counts fixtures won from the fixtures, not from the mean", () => {
    // bun has the better mean and wins only one of the two fixtures.
    expect(find([mean("bun", 2), mean("npm", 3)]).wins).toEqual({ won: 1, of: 2 });
  });

  it("uses the name the section shows, so a registry is not called a client", () => {
    const f = findingFor({
      means: [mean("vlt", 17.4), mean("npm", 28.5)],
      rows,
      fixtureCount: 2,
      baseline: "npm",
      label: (tool) => toolLabel(tool, "registries"),
    });
    expect(f.sentence).toBe(
      "registry.vlt.io is fastest at 17.4s, 1.64× faster than registry.npmjs.org.",
    );
  });

  it("says which fixture it is about when the page is narrowed to one", () => {
    // "bun is fastest at 1.10s" about one project, unqualified, reads as a
    // claim about all of them.
    const on = (means: ToolMean[]) =>
      findingFor({ means, rows, fixtureCount: 2, baseline: "npm", where: "On Astro" }).sentence;
    expect(on([mean("bun", 1.1), mean("npm", 9.74)])).toBe(
      "On Astro, bun is fastest at 1.10s, 8.9× faster than npm.",
    );
    expect(on([])).toBe("On Astro, no completed runs were published for this scenario.");
  });

  it("over the tools left when some are hidden, and says which are hidden", () => {
    const report = readFileSync(new URL("../src/lib/report.ts", import.meta.url), "utf8");
    // `scenarioFacts` sees the bundles, never the `hide` parameter: the
    // unscoped finding is computed first, and kept when nothing is hidden.
    expect(report.indexOf("scenarioFacts(")).toBeLessThan(report.indexOf("query.hide"));
    expect(report).not.toMatch(/scenarioFacts\([^)]*hidden/);
    const on = (hidden: string[], where: string | null = null) =>
      findingFor({
        means: [mean("bun", 1.1), mean("pnpm", 2.2), mean("npm", 9.9)],
        rows,
        fixtureCount: 2,
        baseline: "npm",
        where,
        hidden,
      }).sentence;
    expect(on(["bun"])).toBe("With bun hidden, pnpm is fastest at 2.20s, 4.5× faster than npm.");
    expect(on(["bun"], "On Astro")).toMatch(/^On Astro, with bun hidden, pnpm is fastest/);
    // The baseline hidden is still what the ratio is against; a lone tool left is "shown", not "only".
    expect(on(["bun", "npm"])).toBe(
      "With bun and npm hidden, pnpm is the only tool shown that completed every fixture, at 2.20s, 4.5× faster than npm.",
    );
  });

  it("words a ratio below one as slower, never as a fraction of faster", () => {
    expect(formatVersus(0.5)).toBe("2.0× slower");
    expect(formatVersus(1.42)).toBe("1.42× faster");
    expect(formatRatio(123.4)).toBe("123×");
  });

  it("both pages that state the sentence get it from the one function", () => {
    const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
    for (const page of ["../src/app/about/components.tsx", "../src/lib/report.ts"]) {
      expect(read(page), page).toMatch(/scenarioFacts\(/);
      expect(read(page), page).not.toMatch(/findingFor\(/);
    }
  });
});

describe("inventory 18 · the report's figures draw only what was measured", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const figures = read("../src/components/charts-figures.tsx");
  const series = read("../src/components/charts-echarts.tsx");
  const page = read("../src/app/[section]/[[...params]]/page.tsx");
  const report = read("../src/lib/report.ts");
  const rows = [
    {
      fixture: "astro",
      failed: [],
      values: [
        { tool: "bun", value: 1 },
        { tool: "zpm", value: 0.5 },
        { tool: "npm", value: 4 },
      ],
    },
    {
      fixture: "babylon",
      failed: ["zpm"],
      values: [
        { tool: "bun", value: 3 },
        { tool: "npm", value: 8 },
      ],
    },
  ];

  it("a tool gets a bar only if it completed every fixture, and is named if not", () => {
    // The real case: zpm, 2026-10-13, clean. Its mean over the five fixtures
    // it finished would be the shortest bar on the chart.
    const { bars, partial } = meanBars(rows);
    expect(bars.map((b) => b.tool)).toEqual(["bun", "npm"]);
    expect(partial).toEqual(["zpm"]);
    expect(bars[0]?.value).toBe(2); // (1 + 3) / 2, fastest first
  });

  it("with one fixture selected, the bars are simply that fixture's times", () => {
    const { bars, partial } = meanBars(rows.slice(0, 1));
    expect(bars.map((b) => [b.tool, b.value])).toEqual([
      ["zpm", 0.5],
      ["bun", 1],
      ["npm", 4],
    ]);
    expect(partial).toEqual([]);
  });

  it("a bridge spans only a hole between two runs, never the runs themselves", () => {
    expect(bridges([1, null, null, 4, 5, null, 7, null])).toEqual([
      [1, 2, 3, 4, null, null, null, null],
      [null, null, null, null, 5, 6, 7, null],
    ]);
    expect(bridges([null, 2, 3, null])).toEqual([
      [null, null, null, null],
      [null, null, null, null],
    ]);
  });

  it("on each fixture, every tool that finished it is drawn, and a failure is named", () => {
    // zpm failed babylon: off the means, but its astro time is a time.
    expect(fixtureBars(rows)).toEqual([
      {
        fixture: "astro",
        bars: [
          { tool: "zpm", value: 0.5 },
          { tool: "bun", value: 1 },
          { tool: "npm", value: 4 },
        ],
        failed: [],
      },
      {
        fixture: "babylon",
        bars: [
          { tool: "bun", value: 3 },
          { tool: "npm", value: 8 },
        ],
        failed: ["zpm"],
      },
    ]);
  });

  it("a non-positive value never becomes a bar", () => {
    const { bars } = meanBars([
      {
        fixture: "x",
        failed: [],
        values: [
          { tool: "zero", value: 0 },
          { tool: "fast", value: 1 },
        ],
      },
    ]);
    expect(bars.map((b) => b.tool)).toEqual(["fast"]);
  });

  it("the page builds every bar figure from meanBars or fixtureBars", () => {
    // A bar's tools and values are decided by one of the two tested shapers,
    // never inline: the means in the report, each fixture's times on the page.
    const uses = page.match(/<BarFigure/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    const shaped =
      (report.match(/meanBars\(/g) ?? []).length + (page.match(/fixtureBars\(/g) ?? []).length;
    expect(shaped).toBe(uses.length);
  });

  it("every time series is the one shared component, on the vendored chart", () => {
    // Two line charts built two ways drifted apart once. There is one now.
    expect(page).toMatch(/<TimeSeriesChart/);
    expect(page).toMatch(/markers=\{trend\.markers\}/);
    expect(figures).not.toMatch(/type: "line"/);
    expect(series).toMatch(/<EChartsLineChart\n/);
  });

  it("the time series never joins across a hole, and says so itself", () => {
    // The vendored chart keeps a hole as null (inventory 15); this is the
    // other half, stated at the call rather than left to a default.
    expect(series).toMatch(/connectNulls=\{false\}/);
    expect(series).not.toMatch(/connectNulls(=\{true\}|\s*\/?>)/);
  });

  it("a run with no neighbour is found, wherever it sits", () => {
    // A line with no point markers draws a run only as part of a segment. A
    // run with a hole on both sides has none, and would not be drawn at all.
    expect(loneRuns([1, 2, null, 3, null, 4, 5])).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    // At either edge of the window, one hole is enough: there is no other side.
    expect(loneRuns([1, null, 2, 3, null, 4])).toEqual([true, false, false, false, false, true]);
    // A series that is one run long is all lone.
    expect(loneRuns([null, 7, null])).toEqual([false, true, false]);
    expect(loneRuns([7])).toEqual([true]);
    expect(loneRuns([null, null])).toEqual([false, false]);
  });

  it("the real eleven-day gap leaves the run after it standing alone, and it is marked", () => {
    // 2026-06-17 -> 2026-06-29, then nothing after in an 8-run window ending
    // on the 29th: the 29th has no neighbour and must not vanish.
    const window = [5, 5, 5, ...Array.from({ length: 11 }, () => null), 6];
    expect(loneRuns(window).at(-1)).toBe(true);
    expect(loneRuns(window).filter(Boolean)).toHaveLength(1);
  });

  it("lines carry no resting dots; lone runs get a marker series; nothing is dropped", () => {
    // Not a dot per run -- that was a field of dots -- and not no dots at all.
    expect(series).toMatch(/loneRuns\(plotted\.map\(\(r\) => cell\(r\[tool\]\)\)\)/);
    expect(series).toMatch(/marks\[i\] \? row\[tool\] : null/);
    // Exactly one <Dot>, and it belongs to the lone-run series.
    expect(series.match(/<EChartsLineChart\.Dot /g) ?? []).toHaveLength(1);
    expect(series).toMatch(
      /dataKey=\{`\$\{tool\}\$\{LONE\}`\}[\s\S]{0,200}?<EChartsLineChart\.Dot variant="default" \/>/,
    );
    // Hover shows the stock solid dot at the hovered run: a ring is a version change.
    expect(series).toMatch(/<EChartsLineChart\.ActiveDot variant="border" \/>/);
  });

  it("the log or zoomed axis is the stock axis restyled from shared constants, supplied only then", () => {
    // `chartOptions` is a shallow merge, so a log or zoomed axis is a whole
    // yAxis. It takes its styling from the shared constants, not from
    // ECharts' defaults; an unzoomed linear axis is the stock one.
    expect(series).toMatch(
      /axis === "log" \|\| range !== null\s*\?\s*\{[\s\S]{0,800}?yAxis: \[\s*\{\s*type: axis === "log" \? "log" : "value"/,
    );
    // The brush is a second grid; its miniature goes to log with the plot,
    // and is never zoomed.
    expect(series).toMatch(
      /\{ type: axis === "log" \? "log" : "value", gridIndex: 1, show: false \}/,
    );
    expect(series).toMatch(/axisTick: EVIL_TICK_DOT/);
    expect(series).toMatch(/splitLine: EVIL_SPLIT_LINE/);
    expect(series).toMatch(/\.\.\.EVIL_AXIS_LABEL/);
  });

  it("a theme change repaints the time series, and a new range resets the brush", () => {
    // The vendored chart watches `class`; this app switches `data-theme`. The
    // brush zooms within what was loaded, so loading a new window starts over.
    expect(series).toMatch(
      /const chartKey = `\$\{resolvedTheme\}:\$\{window\.from\}:\$\{window\.to\}`;/,
    );
    expect(series).toMatch(/<EChartsLineChart\n[\s\S]{0,400}?key=\{chartKey\}/);
    expect(series).toMatch(/<EChartsLineChart\.Brush/);
  });

  it("every figure is on the SVG renderer, and the bar axis starts at zero", () => {
    expect(figures).toMatch(/const RENDERER = ECHARTS_RENDERERS\.svg/);
    const inits = figures.match(/echarts\.init\(/g) ?? [];
    expect(inits.length).toBeGreaterThan(0);
    expect(figures.match(/renderer: RENDERER/g) ?? []).toHaveLength(inits.length);
    // Every chart has one value axis, and each starts at zero.
    expect(figures.match(/type: "value",/g) ?? []).toHaveLength(inits.length);
    expect(figures.match(/type: "value",[\s\S]{0,160}?min: 0,/g) ?? []).toHaveLength(inits.length);
    expect(series).toMatch(/const RENDERER = "svg"/);
    expect(series).toMatch(/renderer=\{RENDERER\}/);
  });

  it("colour is the tool's own, resolved by the browser so a theme change repaints it", () => {
    // The figures hand ECharts `var(--color-tool-*)`. A literal colour, or one
    // read once through a canvas, would stay the old theme's until re-render.
    expect(figures).toMatch(/toolColor\(b\.tool\)/);
    expect(figures).not.toMatch(/resolveColors\(/);
    expect(figures).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("bars and lines take their axis styling from one place", () => {
    expect(figures).toMatch(/from "@\/lib\/chart-style"/);
    expect(series).toMatch(/from "@\/lib\/chart-style"/);
    expect(figures).not.toMatch(/type: \[3, 3\], width: 1 \} \} as const/);
  });

  it("the vendored line chart is given colours in the shape it reads", () => {
    // It was passed `color:` for most of its life; the chart reads
    // `colors.light` and drew every series in its fallback grey without a word.
    const ts = read("../src/components/charts-echarts.tsx");
    expect(ts).toMatch(/colors: \{ light: \[paint\(tool\)\] \}/);
    expect(ts).not.toMatch(/\bcolor: (muted|toolColor)/);
  });
});

describe("inventory 19 · a pin and a trend card state a run that exists", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const series = read("../src/components/charts-echarts.tsx");

  it("a click pins the nearest published run, never a day nothing ran", () => {
    // The axis has a slot per calendar day; 2 and 3 are holes.
    const ran = [true, true, false, false, true];
    expect(nearestRun(ran, 1)).toBe(1);
    expect(nearestRun(ran, 3)).toBe(4);
    // Equally far from two runs: the earlier one.
    expect(nearestRun([true, false, true], 1)).toBe(0);
    // Past either end, and with nothing published at all.
    expect(nearestRun(ran, 9)).toBe(4);
    expect(nearestRun([false, false], 0)).toBe(-1);
    expect(series).toMatch(/rows\[nearestRun\(ran, Math\.round\(x \?\? -1\)\)\]\?\.date/);
  });

  it("an `at` that names no loaded run pins nothing", () => {
    // Not a rule over an empty day, and not the legend's values swapped for dashes.
    expect(series).toMatch(/rows\.findIndex\(\(r, i\) => r\.date === at && ran\[i\]\)/);
    expect(series).toMatch(
      /const value = pin < 0 \? latest\(tool\) : cell\(plotted\[pin\]\?\.\[tool\]\)/,
    );
  });

  it("the brush strip and a click on a line do not pin", () => {
    expect(series).toMatch(
      /event\.target != null \|\| !chart\.containPixel\(\{ gridIndex: 0 \}, point\)/,
    );
  });

  it("a trend card's change is first run to last run, and absent with fewer than two", () => {
    expect(windowChange([4, 5, 3])).toEqual({ from: 0, to: 2, change: -0.25 });
    // The tool joined late and missed the last day: its own first and last.
    expect(windowChange([null, 2, null, 3, null])).toEqual({ from: 1, to: 3, change: 0.5 });
    expect(windowChange([null, 2, null])).toBeNull();
    expect(windowChange([])).toBeNull();
    expect(read("../src/components/sections.tsx")).toMatch(/windowChange\(series\)/);
  });

  it("a sparkline has no point markers and does not join across a missing run", () => {
    const spark = read("../src/components/charts-echarts-dots.tsx");
    expect(spark).toMatch(/connectNulls: false/);
    expect(spark).toMatch(/showSymbol: false/);
    expect(spark).not.toMatch(/showSymbol: true|connectNulls: true/);
  });
});

describe("a partial day is a gap on the trend, never a dip", () => {
  it("does not plot a mean over fewer fixtures than ran that day", () => {
    const run = (command: string, mean: number, exit = 0) => ({
      command,
      mean,
      stddev: 0,
      exit_codes: [exit],
    });
    const p = trendPoint("2026-10-02", [
      { fixture: "astro", file: { results: [run("zpm", 1), run("npm", 4)] } as never },
      { fixture: "babylon", file: { results: [run("zpm", 0, 1), run("npm", 40)] } as never },
    ]);
    expect(p?.byTool.zpm).toBeUndefined();
    expect(p?.failed.zpm?.[0]?.fixture).toBe("babylon");
  });
});
