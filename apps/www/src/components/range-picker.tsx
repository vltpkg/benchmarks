"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { usePending } from "@/components/report-pending";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_WINDOW_DAYS, RANGES, reportParams } from "@/lib/params";

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

const words = (from: string, to: string): string => {
  const a = toDate(from);
  const b = toDate(to);
  const short = (d: Date, year: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(year ? { year: "numeric" } : {}),
    });
  return `${short(a, a.getFullYear() !== b.getFullYear())} – ${short(b, true)}`;
};

/**
 * The trend's date range: presets, or an exact start and end from a calendar.
 *
 * ONLY PUBLISHED DATES CAN BE CHOSEN. Every other day is disabled -- days
 * after the run being shown, days before the archive begins, and the days in
 * between on which nothing ran -- so a range cannot start or end on a hole,
 * and the archive's gaps (2026-06-17 to 2026-06-29 is eleven days wide) look
 * like gaps in the calendar. A range may SPAN a hole; the chart draws it as
 * one.
 *
 * This is a server parameter: the window decides which files are fetched. So
 * the write is not shallow, and the page re-renders with the new data.
 *
 * The calendar is react-day-picker's, with its keyboard and screen-reader
 * behaviour as shipped.
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
  const [params, setParams] = useQueryStates(
    { range: reportParams.range, from: reportParams.from, to: reportParams.to },
    { shallow: false, startTransition },
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: toDate(from),
    to: toDate(to),
  });

  const published = new Set(dates.filter((d) => d <= end));
  const first = dates[0] ?? end;
  const ready = draft?.from !== undefined && draft.to !== undefined;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ from: toDate(from), to: toDate(to) });
      }}
    >
      <PopoverTrigger asChild>
        {/* In the figure's top row, one of a pair with the scale menu.
            Below sm it is the icon alone; the range stays its accessible
            name and is the first thing in the popover. */}
        <Button variant="outline" size="sm" className="font-normal">
          <CalendarDays aria-hidden />
          <span className="sr-only">Date range: </span>
          <span className="max-sm:sr-only">
            {custom ? words(from, to) : `Last ${params.range} days`}
          </span>
          <ChevronDown aria-hidden className="max-sm:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-auto flex-col gap-0 p-0 sm:flex-row">
        <div className="flex flex-row flex-wrap gap-1 p-2 max-sm:border-b sm:w-36 sm:flex-col sm:border-r">
          {RANGES.map((days) => {
            const selected = !custom && params.range === days;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  void setParams({ range: days, from: null, to: null });
                  setOpen(false);
                }}
                className={`rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors ${
                  selected
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                Last {days} days
              </button>
            );
          })}
        </div>
        <div>
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            defaultMonth={toDate(to)}
            startMonth={toDate(first)}
            endMonth={toDate(end)}
            max={MAX_WINDOW_DAYS}
            disabled={(date) => !published.has(toIso(date))}
          />
          <div className="flex items-center justify-between gap-4 border-t px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Days with no published run cannot be chosen. Up to {MAX_WINDOW_DAYS} days.
            </p>
            <Button
              size="sm"
              disabled={!ready}
              onClick={() => {
                if (draft?.from === undefined || draft.to === undefined) return;
                void setParams({ from: toIso(draft.from), to: toIso(draft.to) });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
