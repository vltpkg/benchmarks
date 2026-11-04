"use client";

import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { usePending } from "@/components/report-pending";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRESETS, rangeLabel, reportParams } from "@/lib/params";
import { cn } from "@/lib/utils";

/*
 * Dates here are calendar days with no time and no zone. They are built and
 * read with LOCAL getters on both sides, so a published `2026-10-13` is the
 * 13th in the calendar wherever the reader is.
 */
const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const short = (d: Date, year: boolean) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
  });

const words = (from: string, to: string): string => {
  const a = toDate(from);
  const b = toDate(to);
  if (from === to) return short(b, true);
  return `${short(a, a.getFullYear() !== b.getFullYear())} – ${short(b, true)}`;
};

/* Two months side by side from `sm`, one below it. Only read once the
   popover is open, which is always on the client, so the server's answer
   never reaches the page. */
const SM = "(min-width: 40rem)";
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(SM);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
const useWide = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SM).matches,
    () => true,
  );

/** The month a calendar of `months` opens on, so that `to`'s month is the last one shown. */
const openingMonth = (to: string, first: string, months: number): Date => {
  const end = toDate(to);
  const open = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  const start = toDate(first);
  return open < start ? new Date(start.getFullYear(), start.getMonth(), 1) : open;
};

/**
 * The trend's date range: presets, or an exact start and end from a calendar.
 *
 * PRESETS apply at once. They are rolling days ending at the run shown
 * (`lib/params.ts`), and "1 month" is the default, so choosing it clears the
 * parameter. An old `range=90` link is labelled "Last 90 days" and highlights
 * no preset.
 *
 * THE CALENDAR is a draft: picking days changes nothing until Apply, and
 * Escape or a click outside throws the draft away. It reaches across the
 * whole archive -- there is no longest window -- so its caption is a month
 * and a year dropdown rather than a long walk of "previous".
 *
 * ONLY PUBLISHED DATES CAN BE CHOSEN. Every other day is disabled -- days
 * after the run being shown, days before the archive begins, and the days in
 * between on which nothing ran -- so a range cannot start or end on a hole,
 * and the archive's gaps (2026-06-17 to 2026-06-29 is eleven days wide) look
 * like gaps in the calendar. A range may SPAN a hole; the chart draws it as
 * one.
 *
 * This is a server parameter: the window decides which files are fetched. So
 * the write is not shallow, and it runs in the report's pending transition,
 * which keeps the chart on screen, marked stale, until the new data arrives.
 *
 * The calendar is react-day-picker's, with its keyboard and screen-reader
 * behaviour as shipped. The popover is Radix's: it traps focus, closes on
 * Escape and returns focus to the trigger.
 */
export const RangePicker = ({
  dates,
  end,
  from,
  to,
  custom,
}: {
  /** Every published date, ascending. */
  dates: readonly string[];
  /** The run the report is showing; nothing after it can be chosen. */
  end: string;
  /** The window in effect, as the server resolved it. */
  from: string;
  to: string;
  custom: boolean;
}) => {
  const { startTransition } = usePending();
  /* The range's own write, inside the report's: the report goes stale for
     any server parameter, but only this one makes the URL's window news. */
  const [ranging, startRanging] = useTransition();
  const [params, setParams] = useQueryStates(
    { range: reportParams.range, from: reportParams.from, to: reportParams.to },
    { shallow: false, startTransition: (write) => startTransition(() => startRanging(write)) },
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  /* While the server re-renders a new window, the URL's choice is shown at
     once; otherwise the server's, which is the truth when it refused a
     hand-edited range. */
  const asked = ranging && params.from !== null && params.to !== null;
  const exact = ranging ? asked : custom;
  const [start, stop] = asked ? [params.from ?? from, params.to ?? to] : [from, to];
  const label = exact ? words(start, stop) : rangeLabel(params.range);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ from: toDate(start), to: toDate(stop) });
      }}
    >
      <PopoverTrigger asChild>
        {/* In the figure's top row, one of a pair with the scale menu.
            Below sm it is the icon alone; the range stays its accessible
            name and is the first thing in the popover. */}
        <Button variant="outline" size="sm" className="font-normal">
          <CalendarDays aria-hidden />
          <span className="sr-only">Date range: </span>
          <span className="max-sm:sr-only">{label}</span>
          <ChevronDown aria-hidden className="max-sm:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        aria-label="Date range"
        /* Focus opens on the range in effect: its preset, or the calendar's first stop for an exact range. */
        onOpenAutoFocus={(event) => {
          const target = event.currentTarget as HTMLElement;
          const first =
            target.querySelector<HTMLElement>("[aria-pressed=true]") ??
            target.querySelector<HTMLElement>("[data-slot=calendar] td button[tabindex='0']");
          if (first === null) return;
          event.preventDefault();
          first.focus();
        }}
        /* On a phone it can be taller than the room on either side of the trigger; it scrolls rather than leave the screen. */
        className="flex max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-y-auto p-0 sm:flex-row"
      >
        <div
          role="group"
          aria-label="Presets"
          className="flex flex-row flex-wrap gap-1 p-2 max-sm:border-b sm:w-32 sm:flex-col sm:border-r"
        >
          {PRESETS.map((preset) => {
            const selected = !exact && params.range === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  // The default is never written: "1 month" is a plain URL.
                  void setParams({
                    range: preset.value === "1m" ? null : preset.value,
                    from: null,
                    to: null,
                  });
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <Custom
          dates={dates}
          end={end}
          to={stop}
          draft={draft}
          onDraft={setDraft}
          onApply={(range) => {
            void setParams(range);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

/** The calendar half: a draft range, its readout, and Apply. */
const Custom = ({
  dates,
  end,
  to,
  draft,
  onDraft,
  onApply,
}: {
  dates: readonly string[];
  end: string;
  to: string;
  draft: DateRange | undefined;
  onDraft: (range: DateRange | undefined) => void;
  onApply: (range: { from: string; to: string }) => void;
}) => {
  const months = useWide() ? 2 : 1;
  const shown = dates.filter((d) => d <= end);
  const published = new Set(shown);
  const first = shown[0] ?? end;

  const a = draft?.from === undefined ? undefined : toIso(draft.from);
  // A range is complete with both ends; one picked day is a range of one.
  const b = draft?.to === undefined ? undefined : toIso(draft.to);
  const runs = a === undefined ? 0 : shown.filter((d) => d >= a && d <= (b ?? a)).length;

  return (
    <div className="flex flex-col">
      <Calendar
        mode="range"
        selected={draft}
        /* With resetOnSelect, clicking the day of a one-day range clears it;
           here that click starts a new range from that day, like any other. */
        onSelect={(range, day) => onDraft(range ?? { from: day, to: undefined })}
        resetOnSelect
        numberOfMonths={months}
        captionLayout="dropdown"
        defaultMonth={openingMonth(to, first, months)}
        startMonth={toDate(first)}
        endMonth={toDate(end)}
        disabled={(date) => !published.has(toIso(date))}
        className="mx-auto"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-3 py-2.5">
        {/* What Apply will show, read out as it changes. */}
        <p aria-live="polite" className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
          {a === undefined ? (
            <span className="text-muted-foreground">Pick a start and an end</span>
          ) : (
            <>
              <span className="sr-only">Selected: </span>
              <span>{short(toDate(a), b === undefined || a.slice(0, 4) !== b.slice(0, 4))}</span>
              <ArrowRight aria-hidden className="size-3 text-muted-foreground" />
              <span className="sr-only">to</span>
              <span className={b === undefined ? "text-muted-foreground" : undefined}>
                {b === undefined ? "pick an end" : short(toDate(b), true)}
              </span>
              <span className="text-muted-foreground">
                · {runs} {runs === 1 ? "run" : "runs"}
              </span>
            </>
          )}
        </p>
        <Button
          size="sm"
          disabled={a === undefined || b === undefined}
          onClick={() => {
            if (a === undefined || b === undefined) return;
            onApply({ from: a, to: b });
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
};
