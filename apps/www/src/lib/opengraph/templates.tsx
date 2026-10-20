/**
 * The social cards, in vlt.io's card language: black, one weight of Inter,
 * Geist Mono for names and numbers, the mark top left and the words bottom
 * left. Takumi sees no stylesheet, so every colour here is a literal: the
 * neutrals are vlt.io's card palette, the tools' are read from the dark theme
 * in `globals.css`.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { Vlt } from "@/components/icons/vlt";
import { TOOL_ICONS } from "@/components/tool-name";
import { shownBars } from "@/lib/figures";
import { formatDuration, longDate } from "@/lib/findings";
import { formatMs } from "@/lib/measurements";
import type { OgFigure } from "@/lib/og-figure";
import { groupedSvg, lineSvg } from "./charts";
import type { ReportModel } from "@/lib/report";
import { fixtureLabel, toolLabel } from "@/lib/tools";
import { ellipsize } from "./truncate";

const FG = "#fafafa";
const MUTED = "#a1a1a1";
const BORDER = "#262626";
const CHIP = "#0a0a0a";
const MONO = "Geist Mono";

/**
 * Each tool's colour on a dark page, as `globals.css` defines it under
 * `[data-theme="dark"]` -- the stylesheet stays the one place the values live.
 */
let darkColors: Promise<{ readonly [tool: string]: string }> | null = null;
export const toolColors = () =>
  (darkColors ??= readFile(join(process.cwd(), "src", "app", "globals.css"), "utf8").then((css) =>
    Object.fromEntries(
      [
        ...(css.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? "").matchAll(
          /--tool-([\w-]+):\s*(#[0-9a-f]{3,8})\b/gi,
        ),
      ].map(([, tool, color]) => [tool, color]),
    ),
  ));

type IconNode = [string, { [attr: string]: string }][];
type Rendered = ReactElement<{ icon?: { node: IconNode }; children?: ReactNode }>;

/**
 * An icon component as a plain `<svg>`, which takumi rasterises. The marks are
 * forwardRef components, called here for what they return: lucide's
 * (`createLucideIcon`) return its `Icon` with the path data as a prop, which
 * is drawn here in lucide's own defaults; a light/dark pair returns both, and
 * the second is the one drawn for dark pages.
 */
const plainSvg = (icon: ComponentType, size: number, color: string): ReactElement => {
  const el = (icon as unknown as { render: (p: object, ref: null) => Rendered }).render(
    { size },
    null,
  );
  const node = el.props.icon?.node;
  if (node !== undefined) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {node.map(([tag, { key, ...attrs }], i) =>
          createElement(tag, {
            key: key ?? i,
            ...Object.fromEntries(
              Object.entries(attrs).map(([k, v]) => [k, v === "currentColor" ? color : v]),
            ),
          }),
        )}
      </svg>
    );
  }
  if (el.type === "span" && Array.isArray(el.props.children)) {
    const dark = el.props.children[1] as ReactElement<object>;
    return plainSvg(dark.type as ComponentType, size, color);
  }
  return el;
};

/** The navbar's wordmark (`components/navbar/logo.tsx`): the mark, "vlt", "/ benchmarks". */
const Logo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
    {plainSvg(Vlt, 40, FG)}
    <span style={{ color: FG }}>vlt</span>
    <span style={{ color: MUTED, marginLeft: -4 }}>/ benchmarks</span>
  </div>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: "56px 64px",
      backgroundColor: "#000",
      color: FG,
      fontFamily: "Inter",
    }}
  >
    <Logo />
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: string }) => (
  <div style={{ fontFamily: MONO, fontSize: 20, color: MUTED, marginBottom: 16 }}>{children}</div>
);

const Chip = ({ children }: { children: string }) => (
  <span
    style={{
      fontFamily: MONO,
      fontSize: "0.86em",
      letterSpacing: 0,
      padding: "0 0.24em",
      lineHeight: 1.25,
      border: `1px solid ${BORDER}`,
      borderRadius: "0.2em",
      backgroundColor: CHIP,
    }}
  >
    {children}
  </span>
);

/**
 * A headline with names between backticks set as the site's inline-code
 * chips. Takumi draws no box around an inline run, so the line is laid out
 * word by word in a wrapping flex row; a chip is one unbreakable word, with
 * any punctuation it touches kept beside it.
 */
const Headline = ({ marked }: { marked: string }) => {
  const text = ellipsize(marked, 110);
  /* Sized by length, so a typical finding sets in one or two full lines. */
  const size = text.length <= 40 ? 56 : text.length <= 64 ? 48 : text.length <= 88 ? 44 : 40;
  const words: ReactNode[][] = [[]];
  text.split("`").forEach((part, i) => {
    if (i % 2 === 1) return words.at(-1)?.push(<Chip key={i}>{part}</Chip>);
    part.split(" ").forEach((word, j) => {
      if (j > 0) words.push([]);
      if (word !== "") words.at(-1)?.push(word);
    });
  });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `${Math.round(size * 0.12)}px ${Math.round(size * 0.26)}px`,
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: "-0.02em",
      }}
    >
      {words
        .filter((w) => w.length > 0)
        .map((w, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center" }}>
            {w}
          </span>
        ))}
    </div>
  );
};

type Colors = { readonly [tool: string]: string };

/**
 * Bars by tool, fastest first, in the page's stripped style: a bright cap on
 * a dimmed body, the baseline outlined. Only tools that completed every
 * fixture have a bar (`meanBars`); the first six and the baseline are drawn,
 * as on the About page, and the rest counted.
 */
const BarRows = ({
  report,
  all,
  unit,
  colors,
}: {
  report: ReportModel;
  all: readonly { readonly tool: string; readonly value: number }[];
  unit: "s" | "ms";
  colors: Colors;
}) => {
  const section = report.section.id;
  const bars = shownBars(all, report.baseline);
  const more = all.length - bars.length;
  const max = Math.max(...bars.map((b) => b.value));
  const label = (tool: string) => toolLabel(tool, section);
  /* The names' column, as wide as the longest: Geist Mono's advance is 0.6em. */
  const names = 34 + Math.ceil(Math.max(...bars.map((b) => label(b.tool).length)) * 0.6 * 20);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: bars.length > 5 ? 9 : 14,
        flexGrow: 1,
        paddingTop: 32,
        paddingBottom: 36,
        fontFamily: MONO,
        fontSize: 20,
        lineHeight: 1.2,
      }}
    >
      {bars.map((b) => {
        const color = colors[b.tool] ?? MUTED;
        const icon = TOOL_ICONS[b.tool];
        const baseline = b.tool === report.baseline;
        return (
          <div key={b.tool} style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: names }}>
              <div style={{ display: "flex", width: 22, height: 22 }}>
                {icon === undefined ? null : plainSvg(icon, 22, color)}
              </div>
              <span style={{ color: FG }}>{label(b.tool)}</span>
            </div>
            <div style={{ display: "flex", flexGrow: 1, height: 14 }}>
              {/* The cap is an element of its own: takumi draws no one-sided border. */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  width: `${(b.value / max) * 100}%`,
                  minWidth: 4,
                  height: "100%",
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundColor: `${color}38`,
                  ...(baseline ? { border: `2px solid ${color}` } : {}),
                }}
              >
                <div style={{ width: 4, height: "100%", backgroundColor: color }} />
              </div>
            </div>
            <span style={{ width: 110, textAlign: "right", color: baseline ? MUTED : FG }}>
              {unit === "s" ? formatDuration(b.value) : `${formatMs(b.value)}ms`}
            </span>
          </div>
        );
      })}
      {more === 0 ? null : (
        <span style={{ paddingLeft: 34, fontSize: 18, color: MUTED }}>{`+${more} more`}</span>
      )}
    </div>
  );
};

/** Section, scenario, fixture and run: the line above a card's headline. */
const whereOf = (report: ReportModel, extra: readonly string[] = []) =>
  [
    report.section.label,
    report.scenario.variation,
    ...(report.filters.fixture === null ? [] : [fixtureLabel(report.filters.fixture)]),
    ...extra,
    longDate(report.run.date),
  ].join(" · ");

/** A scenario's card: the ranking in miniature under the mark, the finding at the foot. */
export const ReportCard = ({ report, colors }: { report: ReportModel; colors: Colors }) => (
  <Card>
    <BarRows report={report} all={report.timeBars.bars} unit="s" colors={colors} />
    <Eyebrow>{whereOf(report)}</Eyebrow>
    <Headline marked={report.finding.marked} />
  </Card>
);

const PLOT = { width: 1072, height: 220 };

/* The tools a chart draws, as a wrapping row of colour and name. */
const Legend = ({
  report,
  tools,
  colors,
}: {
  report: ReportModel;
  tools: readonly string[];
  colors: Colors;
}) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "6px 22px",
      marginTop: 14,
      fontFamily: MONO,
      fontSize: 17,
      color: MUTED,
    }}
  >
    {tools.map((tool) => (
      <span key={tool} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            ...(tool === report.baseline
              ? { border: `2px solid ${colors[tool] ?? MUTED}` }
              : { backgroundColor: colors[tool] ?? MUTED }),
          }}
        />
        {toolLabel(tool, report.section.id)}
        {tool === report.baseline ? " (baseline)" : ""}
      </span>
    ))}
  </div>
);

/*
 * An ECharts SVG in its own fixed box (in a flex row an image is stretched),
 * with the value axis's top and zero set beside it: takumi draws no text
 * inside an SVG.
 */
const Plot = ({
  svg,
  max,
  unit,
  below,
}: {
  svg: string;
  max: number;
  unit: "s" | "ms";
  below: ReactNode;
}) => (
  <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
    <div style={{ display: "flex", position: "relative", width: PLOT.width, height: PLOT.height }}>
      <img
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        width={PLOT.width}
        height={PLOT.height}
      />
      <span
        style={{
          position: "absolute",
          top: -2,
          left: 0,
          fontFamily: MONO,
          fontSize: 15,
          color: MUTED,
          backgroundColor: "#000",
          paddingRight: 6,
        }}
      >
        {unit === "s" ? formatDuration(max) : `${formatMs(max)}ms`}
      </span>
    </div>
    {below}
  </div>
);

/** Labels spread under a chart's categories or across its dates. */
const AxisRow = ({ labels, spread }: { labels: readonly string[]; spread: "even" | "ends" }) => (
  <div
    style={{
      display: "flex",
      justifyContent: spread === "ends" ? "space-between" : "space-around",
      marginTop: 8,
      fontFamily: MONO,
      fontSize: 16,
      color: MUTED,
    }}
  >
    {labels.map((l, i) => (
      <span key={i}>{l}</span>
    ))}
  </div>
);

const TITLES: { readonly [F in OgFigure]: (measure: string) => string } = {
  "time-trend": () => "Performance over time",
  "time-bars": (m) => `Total ${m} time by tool`,
  "time-by-fixture": (m) => `Total ${m} time by fixture`,
  "per-package-chart": () => "Per-package time by tool",
  "per-package-by-fixture": () => "Per-package time by fixture",
};

/**
 * One figure's card, for a link to it (`?figure=`): the figure itself where
 * the ranking is on the report's card, then where it is from and its title.
 */
export const FigureCard = ({
  report,
  figure,
  colors,
}: {
  report: ReportModel;
  figure: OgFigure;
  colors: Colors;
}) => {
  const hidden = (tool: string) => report.filters.hide.includes(tool);
  const order = [...report.ranked, ...report.unranked].filter((t) => !hidden(t));
  const short = (iso: string | undefined) => (iso === undefined ? "" : longDate(iso));
  let body: ReactNode;
  let extra: string[] = [];
  if (figure === "time-bars" || figure === "per-package-chart") {
    const per = figure === "per-package-chart";
    body = (
      <BarRows
        report={report}
        all={(per ? report.perPackageBars : report.timeBars).bars.filter((b) => !hidden(b.tool))}
        unit={per ? "ms" : "s"}
        colors={colors}
      />
    );
  } else if (figure === "time-by-fixture") {
    const fixtures = report.timeRows.map((r) => ({
      fixture: r.fixture,
      values: Object.fromEntries(
        r.values.filter((v) => !hidden(v.tool)).map((v) => [v.tool, v.value]),
      ),
    }));
    const tools = order.filter((t) => fixtures.some((f) => f.values[t] !== undefined));
    const { svg, max } = groupedSvg(fixtures, tools, colors, PLOT);
    body = (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Plot
          svg={svg}
          max={max}
          unit="s"
          below={<AxisRow labels={fixtures.map((f) => fixtureLabel(f.fixture))} spread="even" />}
        />
        <Legend report={report} tools={tools} colors={colors} />
      </div>
    );
  } else {
    const per = figure === "per-package-by-fixture";
    const lane = per
      ? (report.trend.perPackageByFixture.find((f) => f.fixture === report.filters.fixture) ??
        report.trend.perPackageByFixture[0])
      : null;
    if (lane != null) extra = [`on ${fixtureLabel(lane.fixture)}`];
    const rows = lane?.rows ?? report.trend.rows;
    const unit = per || report.trend.plotted === "per-package" ? "ms" : "s";
    const tools = order.filter((t) => rows.some((r) => typeof r[t] === "number"));
    const { svg, max } = lineSvg(rows, tools, colors, report.baseline, PLOT);
    body = (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Plot
          svg={svg}
          max={max}
          unit={unit}
          below={
            <AxisRow
              labels={[
                short(rows[0]?.date as string | undefined),
                short(rows.at(-1)?.date as string | undefined),
              ]}
              spread="ends"
            />
          }
        />
        <Legend report={report} tools={tools} colors={colors} />
      </div>
    );
  }
  return (
    <Card>
      {body}
      <div style={{ flexGrow: 1, minHeight: 20 }} />
      <Eyebrow>{whereOf(report, extra)}</Eyebrow>
      <Headline marked={TITLES[figure](report.measure)} />
    </Card>
  );
};

/** The card for everything else: the site, or a benchmark with nothing to rank. */
export const SiteCard = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) => (
  <Card>
    <div style={{ flexGrow: 1 }} />
    <Eyebrow>{eyebrow}</Eyebrow>
    <Headline marked={title} />
    {description === undefined ? null : (
      <p style={{ margin: 0, marginTop: 20, fontSize: 28, lineHeight: 1.4, color: MUTED }}>
        {ellipsize(description, 140)}
      </p>
    )}
  </Card>
);
