"use client";

import { Activity, ArrowDown, ArrowUp, ArrowUpDown, GitCommitHorizontal, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { compare } from "@/components/data-table";
import { Segmented } from "@/components/segmented";
import { ToolName } from "@/components/tool-name";
import { formatDuration } from "@/lib/findings";
import { reportParams, tableSortOf, withTableSort } from "@/lib/params";
import { toolLabel } from "@/lib/tools";
import type { TrendPoint } from "@/lib/load";
import type { SectionId } from "@/lib/sections";

export type TrendDetail = Omit<TrendPoint, "byTool" | "perPackage">;

/** One tool on the pinned run, everything the panel says about it. */
export interface PinnedTool {
  readonly tool: string;
  /** The plotted value, already formatted for the metric; `null` when not plotted. */
  readonly shown: string | null;
  /** The same value as a number, to sort by. */
  readonly value: number | null;
  /** Its seconds against its own previous run in the window, as a fraction. */
  readonly sincePrevious: number | null;
  /** Its seconds over the baseline's on this run. */
  readonly versusBaseline: number | null;
  readonly version: string | null;
}

/** Something worth knowing about one tool on the pinned run, the chart's rings in words. */
export interface PinnedNote {
  readonly tool: string;
  /** A version change (the solid ring), or a run far from its neighbours (the dashed one). */
  readonly kind: "version" | "unusual";
  readonly text: string;
  readonly detail?: string;
}

const percent = (fraction: number): string =>
  `${fraction > 0 ? "+" : ""}${(fraction * 100).toFixed(Math.abs(fraction) < 0.1 ? 1 : 0)}%`;

const BUTTON =
  "rounded-sm underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground disabled:pointer-events-none disabled:no-underline disabled:opacity-50";

/**
 * The pinned run, explained: a table under the plot of every tool on that
 * run -- the plotted value, the move since its previous run, the multiple of
 * the baseline, the spread across repetitions, how many fixtures it completed
 * and the version it ran -- or the same run fixture by fixture.
 *
 * Its actions are the page's: open this run as the run the whole page shows,
 * or take a point (or the whole run) out of every trend. The run being shown
 * cannot be taken out; the page's numbers are about it.
 */
export const PinnedRun = ({
  date,
  label,
  detail,
  tools,
  section,
  baselineName,
  isShown,
  ringNotes: notes = [],
  onOpen,
  onExclude,
  onClose,
}: {
  date: string;
  label: string;
  detail: TrendDetail | undefined;
  tools: readonly PinnedTool[];
  section: SectionId;
  baselineName: string | null;
  /** True when this is the run the page is already showing. */
  isShown: boolean;
  /** What the rings on this run mean: version changes and unusual runs. */
  ringNotes?: readonly PinnedNote[];
  onOpen: () => void;
  onExclude: (entry: string) => void;
  onClose: () => void;
}) => {
  const [view, setView] = useState<"summary" | "fixtures">("summary");
  const fixtures = detail?.fixtures ?? [];
  const rows = tools.filter(
    (t) =>
      t.shown !== null ||
      detail?.partial[t.tool] !== undefined ||
      (detail?.failed[t.tool]?.length ?? 0) > 0,
  );
  /*
   * Sorting, as every table here sorts (`DataTable`): a header click cycles
   * ascending, descending, unsorted; the state is a `sort` entry in the URL,
   * one per view; an absent value (a DNF, a dash) sorts last either way.
   */
  const [entries, setEntries] = useQueryState("sort", reportParams.sort);
  const table = view === "summary" ? "pinned" : "pinned-fixtures";
  const columns =
    view === "summary"
      ? ["tool", "value", "since", "baseline", "rsd", "fixtures", "version"]
      : ["tool", ...fixtures];
  const sort = tableSortOf(entries, table, columns);
  const by = (t: PinnedTool, column: string): number | string | null => {
    if (column === "tool") return toolLabel(t.tool, section);
    if (view === "fixtures") return detail?.byFixture[t.tool]?.[column] ?? null;
    if (column === "value") return t.value;
    if (column === "since") return t.sincePrevious;
    if (column === "baseline") return t.versusBaseline;
    if (column === "rsd") return detail?.rsd[t.tool] ?? null;
    if (column === "fixtures") return Object.keys(detail?.byFixture[t.tool] ?? {}).length;
    return t.version;
  };
  const ordered =
    sort === null
      ? rows
      : [...rows].sort((a, b) =>
          compare(by(a, sort.column), by(b, sort.column), sort.direction === "asc" ? 1 : -1),
        );
  const cycle = (column: string) =>
    void setEntries(
      withTableSort(
        entries,
        table,
        sort?.column !== column
          ? { column, direction: "asc" }
          : sort.direction === "asc"
            ? { column, direction: "desc" }
            : null,
      ),
    );
  const Sortable = ({
    column,
    children,
    className,
    left = false,
  }: {
    column: string;
    children: React.ReactNode;
    className: string;
    left?: boolean;
  }) => {
    const active = sort?.column === column;
    const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={!active ? undefined : sort.direction === "asc" ? "ascending" : "descending"}
        className={className}
      >
        <button
          type="button"
          onClick={() => cycle(column)}
          className={`group inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground ${
            active ? "text-foreground" : ""
          } ${left ? "" : "flex-row-reverse"}`}
        >
          {children}
          <Icon
            aria-hidden
            className={`size-3 shrink-0 ${
              active ? "" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
            }`}
          />
        </button>
      </th>
    );
  };
  const cell = "px-3 py-2 text-right font-mono text-[0.8125rem] whitespace-nowrap tabular-nums";
  const head = "px-3 py-2 text-xs font-normal whitespace-nowrap text-muted-foreground";
  const num = `${head} text-right`;
  const reason = isShown ? "This is the run the page is showing" : undefined;

  return (
    <div className="border-t">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 text-[0.8125rem]">
        <p className="text-muted-foreground">
          Pinned run · <span className="text-foreground">{label}</span>
          {fixtures.length === 0 ? null : (
            <span>
              {" "}
              · {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"} ran
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
          <Segmented
            options={[
              { value: "summary", label: "Summary" },
              { value: "fixtures", label: "By fixture" },
            ]}
            value={view}
            onChange={(value) => setView(value === "fixtures" ? "fixtures" : "summary")}
          />
          <button type="button" className={BUTTON} onClick={onOpen} disabled={isShown}>
            Open this run
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => onExclude(date)}
            disabled={isShown}
            title={reason}
          >
            Exclude run
          </button>
          <button
            type="button"
            aria-label="Unpin"
            onClick={onClose}
            className="grid size-6 place-items-center rounded-md hover:bg-accent hover:text-foreground"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      </div>
      {notes.length === 0 ? null : (
        /* The rings the tooltip explains on hover, kept in words once pinned. */
        <ul
          aria-label="Notes on this run"
          className="space-y-1.5 border-t px-4 py-3 text-[0.8125rem]"
        >
          {notes.map((note) => {
            const Icon = note.kind === "version" ? GitCommitHorizontal : Activity;
            return (
              <li
                key={`${note.kind}:${note.tool}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <ToolName tool={note.tool} section={section} />
                <span className="font-mono text-foreground">{note.text}</span>
                {note.detail === undefined ? null : (
                  <span className="text-muted-foreground">{note.detail}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="overflow-x-auto border-t">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <Sortable column="tool" className={`${head} text-left`} left>
                Tool
              </Sortable>
              {view === "summary" ? (
                <>
                  <Sortable column="value" className={num}>
                    Value
                  </Sortable>
                  <Sortable column="since" className={num}>
                    Since previous
                  </Sortable>
                  {baselineName === null ? null : (
                    <Sortable column="baseline" className={num}>
                      × {baselineName}
                    </Sortable>
                  )}
                  <Sortable column="rsd" className={`${num} max-sm:hidden`}>
                    ± RSD
                  </Sortable>
                  <Sortable column="fixtures" className={num}>
                    Fixtures
                  </Sortable>
                  <Sortable column="version" className={`${num} max-sm:hidden`}>
                    Version
                  </Sortable>
                  <th scope="col" className={num}>
                    <span className="sr-only">Actions</span>
                  </th>
                </>
              ) : (
                fixtures.map((f) => (
                  <Sortable key={f} column={f} className={num}>
                    {f}
                  </Sortable>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {ordered.map((t) => {
              const done = Object.keys(detail?.byFixture[t.tool] ?? {}).length;
              const failed = detail?.failed[t.tool] ?? [];
              const partial = detail?.partial[t.tool];
              return (
                <tr key={t.tool} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">
                    <ToolName tool={t.tool} section={section} />
                  </th>
                  {view === "summary" ? (
                    <>
                      <td className={cell}>
                        {t.shown ?? (
                          <span
                            className="text-muted-foreground"
                            title={
                              partial === undefined
                                ? undefined
                                : `${formatDuration(partial.mean)} over ${partial.of} of ${fixtures.length} fixtures`
                            }
                          >
                            DNF
                          </span>
                        )}
                      </td>
                      <td className={`${cell} text-muted-foreground`}>
                        {t.sincePrevious === null ? "—" : percent(t.sincePrevious)}
                      </td>
                      {baselineName === null ? null : (
                        <td className={`${cell} text-muted-foreground`}>
                          {t.versusBaseline === null ? "—" : `${t.versusBaseline.toFixed(2)}×`}
                        </td>
                      )}
                      <td className={`${cell} text-muted-foreground max-sm:hidden`}>
                        {detail?.rsd[t.tool] === undefined
                          ? "—"
                          : `±${((detail.rsd[t.tool] ?? 0) * 100).toFixed(1)}%`}
                      </td>
                      <td
                        className={`${cell} ${done < fixtures.length ? "text-foreground" : "text-muted-foreground"}`}
                        title={
                          failed.length === 0
                            ? undefined
                            : failed
                                .map(
                                  (f) =>
                                    `DNF on ${f.fixture}${Number.isNaN(f.exit) ? "" : ` (exit ${f.exit})`}`,
                                )
                                .join(", ")
                        }
                      >
                        {done}/{fixtures.length}
                      </td>
                      <td className={`${cell} text-muted-foreground max-sm:hidden`}>
                        {t.version ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[0.8125rem] whitespace-nowrap text-muted-foreground">
                        <button
                          type="button"
                          className={BUTTON}
                          onClick={() => onExclude(`${t.tool}@${date}`)}
                          disabled={isShown}
                          title={reason}
                        >
                          Exclude
                        </button>
                      </td>
                    </>
                  ) : (
                    fixtures.map((f) => {
                      const seconds = detail?.byFixture[t.tool]?.[f];
                      const fail = failed.find((x) => x.fixture === f);
                      return (
                        <td key={f} className={cell}>
                          {seconds !== undefined ? (
                            formatDuration(seconds)
                          ) : fail !== undefined ? (
                            <span className="text-muted-foreground">
                              DNF{Number.isNaN(fail.exit) ? "" : ` (${fail.exit})`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
