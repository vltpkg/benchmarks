"use client";

import { useState, type ComponentProps } from "react";
import { TimeSeriesChart } from "@/components/charts-echarts";
import type { TrendDetail } from "@/components/pinned-run";
import { FigureTabStrip } from "@/components/tabbed-figure";
import { FixtureName } from "@/components/tool-name";
import { fixtureLabel } from "@/lib/tools";

type Rows = ComponentProps<typeof TimeSeriesChart>["rows"];

/**
 * Each run as one fixture saw it: the failures there and no others, nothing
 * partial (one fixture is all or nothing), and that fixture's own spread for
 * the band.
 */
const onFixture = (trend: readonly TrendDetail[], fixture: string): TrendDetail[] =>
  trend.map((d) => ({
    ...d,
    fixtures: d.fixtures.filter((f) => f === fixture),
    partial: {},
    failed: Object.fromEntries(
      Object.entries(d.failed)
        .map(([tool, list]) => [tool, list.filter((e) => e.fixture === fixture)] as const)
        .filter(([, list]) => list.length > 0),
    ),
    rsd: Object.fromEntries(
      Object.entries(d.rsdByFixture).flatMap(([tool, by]) =>
        by[fixture] === undefined ? [] : [[tool, by[fixture]]],
      ),
    ),
  }));

/**
 * Per-package time on each fixture, run by run: the report's own
 * "Performance over time" chart, whole -- range, display, pin, brush, value
 * zoom, legend -- with a tab per fixture where its title tab was. The metric
 * is per package and has no menu; the chart's own view is kept apart in the
 * URL (`pp-*`) from the main chart's, and the window, hidden tools,
 * exclusions and focus are the page's.
 */
export const FixtureTimeSeries = ({
  id,
  title,
  fixtures,
  trend,
  ...chart
}: Omit<
  ComponentProps<typeof TimeSeriesChart>,
  "rows" | "yLabel" | "tabs" | "firstTabActive" | "fixedMetric" | "scope"
> & {
  fixtures: readonly { readonly fixture: string; readonly rows: Rows }[];
}) => {
  const [active, setActive] = useState(fixtures[0]?.fixture ?? "");
  const shown = fixtures.find((f) => f.fixture === active) ?? fixtures[0];
  if (shown === undefined) return null;
  return (
    <TimeSeriesChart
      key={shown.fixture}
      {...chart}
      id={id}
      title={title}
      rows={shown.rows}
      trend={onFixture(trend ?? [], shown.fixture)}
      yLabel={`Time per installed package on ${fixtureLabel(shown.fixture)}`}
      fixedMetric="per-package"
      scope="pp"
      firstTabActive={shown === fixtures[0]}
      tabs={
        <FigureTabStrip
          label={title}
          tabs={fixtures.map((f) => ({
            value: f.fixture,
            label: <FixtureName key={f.fixture} fixture={f.fixture} />,
          }))}
          value={shown.fixture}
          onChange={setActive}
        />
      }
    />
  );
};
