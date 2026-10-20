"use client";

import * as echarts from "echarts/core";
import { LineChart as ELineChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import { toolColor } from "@/lib/chart-model";

echarts.use([ELineChart, GridComponent, SVGRenderer]);

/**
 * The sparkline, on ECharts, and the hook the hand-built figures share.
 *
 * EvilCharts ships no sparkline, so it is built directly on the same engine
 * rather than bent out of a preset. The design wins over what a registry happens to provide
 * (D1), and the engine is still ECharts, so the visual language stays one
 * system.
 *
 * `SVGRenderer` only — registered here and passed explicitly. Canvas is not
 * inspectable, not assertable and not reachable by assistive technology.
 */

export const useChart = (
  build: (el: HTMLDivElement) => echarts.ECharts | null,
  deps: readonly unknown[],
) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const inst = build(el);
    if (inst === null) return;
    /* Its own box, not the window: a tab or a layout change resizes a chart too. */
    const observer = new ResizeObserver(() => inst.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      inst.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
};

export const SparklineECharts = ({
  values,
  tool,
  width,
  height = 24,
  accent = false,
}: {
  /** One slot per published run; `null` where the tool has no usable value. */
  values: readonly (number | null)[];
  tool: string;
  /** Omitted, it fills its container. */
  width?: number;
  height?: number;
  /** Draw the last segment heavier, and the rest quieter: the latest movement. */
  accent?: boolean;
}) => {
  const present = values.filter((v): v is number => typeof v === "number");
  const color = toolColor(tool);

  const ref = useChart(
    (el) => {
      if (present.length < 2) return null;
      const inst = echarts.init(el, undefined, { renderer: "svg", width, height });
      /* A line and a soft fill beneath it, and NO point markers: at this size
         a dot per run is noise, and an end dot is a claim about one run. */
      const line = {
        type: "line",
        /* Explicit, and the whole point: a null is a run with no value and
           must break the line rather than be bridged. */
        connectNulls: false,
        showSymbol: false,
        silent: true,
      } as const;
      const last = values.findLastIndex((v) => v !== null);
      inst.setOption({
        animation: false,
        grid: { left: 1, right: 1, top: 3, bottom: 1 },
        xAxis: { type: "category", show: false, boundaryGap: false, data: values.map((_, i) => i) },
        yAxis: { type: "value", show: false, scale: true },
        series: [
          {
            ...line,
            data: values,
            lineStyle: { width: accent ? 1 : 1.5, color, opacity: accent ? 0.5 : 1 },
            areaStyle: { color, opacity: 0.12, origin: "start" },
          },
          ...(accent
            ? [
                {
                  ...line,
                  data: values.map((v, i) => (i >= last - 1 ? v : null)),
                  lineStyle: { width: 2, color },
                },
              ]
            : []),
        ],
      });
      return inst;
    },
    [values, tool, width, height, accent],
  );

  if (present.length < 2) {
    return <span className="text-xs text-muted-foreground">not enough runs</span>;
  }
  return <div ref={ref} style={{ width: width ?? "100%", height }} />;
};
