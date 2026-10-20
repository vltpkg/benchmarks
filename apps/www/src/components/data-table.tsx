"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { reportParams, tableSortOf, withTableSort } from "@/lib/params";

/**
 * The one table: the docs site's look, the previous app's sorting.
 *
 * A header row of muted sans labels in the panel's own colour (a tinted one
 * would put a band of another shade under the container's tab); hairlines
 * between rows; generous cells; values in mono. It has no border or
 * radius of its own: it sits inside the figure container's panel, which is
 * the frame, and two frames would be one too many. Every column sorts, as the previous app's tables did
 * (tmp/app/src/components/variation/table.tsx).
 *
 * The server shapes everything. Each cell arrives as what to DRAW (`node`,
 * already rendered) and what to sort BY (`sort`), so this island decides
 * nothing about the data -- only the order of rows it was given. A cell with
 * no sort value (a DNF, a tool that did not run) always sorts last, in either
 * direction: an absent measurement is not the smallest one.
 *
 * Sort state is in the URL (`sort`, one entry per table), shallow: it changes
 * what this island draws and nothing the server computes.
 */
export interface Column {
  readonly id: string;
  readonly label: ReactNode;
  readonly align?: "left" | "right";
  /** Plain-text name for the sort button's accessible label. */
  readonly name: string;
}

export interface Row {
  readonly id: string;
  readonly cells: {
    readonly [column: string]: {
      readonly node: ReactNode;
      readonly sort: number | string | null;
    };
  };
}

/** One cell against another: numbers numerically, text alphabetically, an absent value always last. */
export const compare = (
  a: number | string | null,
  b: number | string | null,
  sign: 1 | -1,
): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
  return String(a).localeCompare(String(b)) * sign;
};

export const DataTable = ({
  id,
  columns,
  rows,
}: {
  /** Names this table in the `sort` parameter. */
  id: string;
  columns: readonly Column[];
  rows: readonly Row[];
}) => {
  const [entries, setEntries] = useQueryState("sort", reportParams.sort);
  const sort = tableSortOf(
    entries,
    id,
    columns.map((c) => c.id),
  );

  const ordered =
    sort === null
      ? rows
      : [...rows].sort((a, b) =>
          compare(
            a.cells[sort.column]?.sort ?? null,
            b.cells[sort.column]?.sort ?? null,
            sort.direction === "asc" ? 1 : -1,
          ),
        );

  /* Unsorted -> ascending -> descending -> the table's own order again. */
  const cycle = (column: string) => {
    const next =
      sort?.column !== column
        ? ({ column, direction: "asc" } as const)
        : sort.direction === "asc"
          ? ({ column, direction: "desc" } as const)
          : null;
    void setEntries(withTableSort(entries, id, next));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.875rem]">
        <thead>
          <tr className="border-b">
            {columns.map((column) => {
              const active = sort?.column === column.id;
              const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    !active ? undefined : sort.direction === "asc" ? "ascending" : "descending"
                  }
                  className={`h-11 px-4 font-medium whitespace-nowrap ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => cycle(column.id)}
                    aria-label={`Sort by ${column.name}`}
                    className={`group inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground ${
                      active ? "text-foreground" : "text-muted-foreground"
                    } ${column.align === "right" ? "flex-row-reverse" : ""}`}
                  >
                    {column.label}
                    <Icon
                      aria-hidden
                      className={`size-3.5 shrink-0 ${
                        active
                          ? ""
                          : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
                      }`}
                    />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr
              key={row.id}
              className="border-b border-line-soft transition-colors last:border-0 hover:bg-accent/40"
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={`px-4 py-3.5 align-top ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {row.cells[column.id]?.node ?? null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
