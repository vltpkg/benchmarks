"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQueryStates } from "nuqs";
import { useLayoutEffect, useRef, type Ref } from "react";
import { METRIC_LABELS } from "@/components/charts-echarts";
import { FADE, SPRING } from "@/components/page-row";
import { usePending } from "@/components/report-pending";
import type { Metric } from "@/lib/figures";
import { reportParams } from "@/lib/params";
import { parseValueRange } from "@/lib/value-range";

type Key = keyof typeof reportParams;

/** A server-applied choice, as the server resolved it: only what actually narrowed the page. */
export interface ServerChip {
  readonly label: string;
  readonly value: string;
  /** The parameters that clearing it removes. */
  readonly clear: readonly Key[];
}

const shortDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/* In: a fade and a small scale. Out: the same, popped out of the row so its neighbours close the gap. */
const MOTION = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: SPRING,
};
/* Reduced: a fade in, and out at once. At rest it is MOTION's, so the server's render (which cannot know) hydrates. */
const REDUCED = {
  initial: { opacity: 0 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, transition: { duration: 0 } },
  transition: FADE,
};

/* Takes the ref AnimatePresence's popLayout hands its direct children, to lift a leaving chip out of the row. */
const Chip = ({
  label,
  value,
  onClear,
  reduced,
  ref,
}: {
  label: string;
  value: string;
  onClear: () => void;
  reduced: boolean;
  ref?: Ref<HTMLLIElement>;
}) => (
  <motion.li ref={ref} layout={reduced ? false : "position"} {...(reduced ? REDUCED : MOTION)}>
    <button
      type="button"
      onClick={onClear}
      aria-label={`Reset ${label}: ${value}`}
      className="group inline-flex h-6 items-center gap-1.5 rounded-md border pr-1 pl-2 text-xs text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {label}
      <span className="font-mono text-foreground">{value}</span>
      <XIcon aria-hidden className="size-3 opacity-60 group-hover:opacity-100" />
    </button>
  </motion.li>
);

/**
 * The page's non-default choices, each one click from undone. Quiet by
 * design: with everything at its default, nothing renders.
 *
 * Fixture and hidden tools have none: the menus in the row above already
 * show and undo them. The other server choices (window, metric, exclusions)
 * arrive resolved, so a value the page ignored has no chip; clearing one is a
 * navigation. The trend's own choices (the y zoom, the pinned run) are read
 * here, live, and cleared in place.
 *
 * A server chip is drawn only while the live URL still holds one of its
 * parameters, so a cleared chip goes at once rather than when the server
 * answers -- and if that navigation never lands, the URL decides.
 *
 * The list stays mounted, hidden while empty, so the last chip can animate
 * out too. A leaving chip is popped out of the row, so the row's height is
 * already what it will be, and the space around it (PageRow) moves with it.
 */
export const SelectionChips = ({
  server,
  metric,
  runs,
}: {
  server: readonly ServerChip[];
  /** The metric the trend plots, when it is not the default and can be plotted here. */
  metric: Metric | null;
  /** The runs the trend has loaded: a pin on any other date pins nothing. */
  runs: readonly string[];
}) => {
  const [live, set] = useQueryStates(reportParams);
  const { y, at, scale } = live;
  const { startTransition, startToolsTransition } = usePending();
  const reduced = useReducedMotion() === true;
  const zoom = parseValueRange(y, scale === "log");
  /* Clearing the focus leaves the chart's data as it is, so it reloads as the
     tools menu does: the trend stays live. Everything else reloads the data. */
  const navigate = (keys: readonly Key[]) =>
    void set(Object.fromEntries(keys.map((k) => [k, null])), {
      shallow: false,
      startTransition: keys.every((k) => k === "focus") ? startToolsTransition : startTransition,
    });
  const held = (key: Key): boolean => {
    const value: unknown = live[key];
    const fallback: unknown =
      "defaultValue" in reportParams[key] ? reportParams[key].defaultValue : null;
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== fallback;
  };
  const shown = server.filter((chip) => chip.clear.some(held));
  const metricChip = held("metric") ? metric : null;

  const pinned = at !== null && runs.includes(at);
  const count =
    shown.length + (metricChip === null ? 0 : 1) + (zoom === null ? 0 : 1) + (pinned ? 1 : 0);

  const list = useRef<HTMLUListElement>(null);
  // The last chip to leave is popped out of the row, which would snap the floating card shut around it: the row keeps its width until a chip returns.
  useLayoutEffect(() => {
    const ul = list.current;
    if (ul === null) return;
    const edges = [...ul.querySelectorAll("li")].map((li) => li.offsetLeft + li.offsetWidth);
    ul.style.minWidth = count > 0 ? "" : `${Math.max(0, ...edges)}px`;
  }, [count]);

  return (
    <ul
      ref={list}
      aria-label="Active selections"
      className="relative flex flex-wrap gap-1.5 empty:hidden"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((chip) => (
          <Chip
            key={chip.label}
            reduced={reduced}
            label={chip.label}
            value={chip.value}
            onClear={() => navigate(chip.clear)}
          />
        ))}
        {metricChip === null ? null : (
          <Chip
            key="metric"
            reduced={reduced}
            label="metric"
            value={METRIC_LABELS[metricChip]}
            onClear={() => navigate(["metric"])}
          />
        )}
        {zoom === null ? null : (
          <Chip
            key="y zoom"
            reduced={reduced}
            label="y zoom"
            value={zoom === "fit" ? "fit" : `${zoom[0]}–${zoom[1]}`}
            onClear={() => void set({ y: null })}
          />
        )}
        {!pinned ? null : (
          <Chip
            key="pinned"
            reduced={reduced}
            label="pinned"
            value={shortDay(at)}
            onClear={() => void set({ at: null })}
          />
        )}
      </AnimatePresence>
    </ul>
  );
};
