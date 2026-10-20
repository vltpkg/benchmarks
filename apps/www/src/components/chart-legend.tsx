"use client";

import { useHidden } from "@/components/tools-menu";
import { ToolName } from "@/components/tool-name";
import { toolColor } from "@/lib/chart-model";
import type { SectionId } from "@/lib/sections";

/**
 * The legend: a bordered grid at the foot of the panel, on every chart that
 * needs one.
 *
 * One cell per tool, hairlines between the cells in the panel's own border
 * colour. In a cell: a marker in the tool's brand colour (dashed for the
 * baseline, as its line or outline is), its mark and its name on the left,
 * and its latest value on the right in mono -- inside one box, so the value
 * plainly belongs to the name beside it.
 *
 * Each cell is a button that shows or hides its tool, through the same `hide`
 * parameter the tools menu writes. A hidden tool's cell is recessed
 * to the shell's shade, struck through, and says "hidden" where its value
 * was.
 *
 * Two, three or five columns. The last row is filled out with empty cells so
 * the grid is always a rectangle with every border drawn: with eleven tools
 * in five columns that is four blanks, which reads as a table with empty
 * cells rather than as a ragged edge.
 *
 * It is drawn with a 1px gap over a border-coloured ground rather than with
 * borders on the cells, so there is no doubled line where two cells meet and
 * none against the panel's own edge.
 */
export interface LegendEntry {
  readonly tool: string;
  readonly on: boolean;
  /** The tool's latest value, already formatted; `null` when it has none. */
  readonly value?: string | null;
}

/* How many blanks complete the last row at each column count. */
const blanks = (count: number, columns: number): number => (columns - (count % columns)) % columns;

export const ChartLegend = ({
  entries,
  section,
  baseline,
  onToggle,
  onShowAll,
}: {
  entries: readonly LegendEntry[];
  section: SectionId;
  baseline: string | null;
  onToggle: (tool: string) => void;
  onShowAll: () => void;
}) => {
  /* Six or fewer (the registries) get three wide columns: five squeezed their long names. */
  const wide = entries.length <= 6;
  const fill = {
    base: blanks(entries.length, 2),
    sm: blanks(entries.length, 3),
    lg: blanks(entries.length, wide ? 3 : 5),
  };
  const most = Math.max(fill.base, fill.sm, fill.lg);

  return (
    <div className="border-t">
      <ul
        aria-label="Tools shown"
        className={`grid grid-cols-2 gap-px bg-border sm:grid-cols-3 ${wide ? "" : "lg:grid-cols-5"}`}
      >
        {entries.map(({ tool, on, value }) => (
          <li key={tool} className="min-w-0">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(tool)}
              title={on ? "Hide this tool" : "Show this tool"}
              className={`flex h-full w-full min-w-0 items-center gap-x-2.5 gap-y-1 max-sm:flex-wrap px-4 py-3 text-left text-[0.8125rem] transition-colors focus-visible:-outline-offset-2 ${
                on
                  ? "bg-(--code-editor-background) hover:bg-accent"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* The swatch and the name wrap as one; the value goes under them when the cell is narrow. */}
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-[2px] ${
                    on && tool === baseline ? "border border-dashed" : ""
                  }`}
                  style={
                    !on
                      ? { background: "var(--border)" }
                      : tool === baseline
                        ? { borderColor: toolColor(tool) }
                        : { background: toolColor(tool) }
                  }
                />
                <span className="flex min-w-0 flex-col [overflow-wrap:break-word]">
                  <ToolName
                    tool={tool}
                    section={section}
                    className={`min-w-0 [&>svg]:shrink-0 ${on ? "" : "line-through opacity-60"}`}
                  />
                  {/* The dashed marker means nothing to a reader who has not met it: say it, under the name. */}
                  {tool === baseline ? (
                    <span className="pl-6 font-mono text-[0.625rem] tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                      Baseline
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-muted-foreground">
                {!on ? "hidden" : (value ?? "")}
              </span>
            </button>
          </li>
        ))}
        {Array.from({ length: most }, (_, i) => (
          <li
            key={`blank-${i}`}
            aria-hidden
            className={`bg-(--code-editor-background) ${i < fill.base ? "max-sm:block" : "max-sm:hidden"} ${
              i < fill.sm ? "sm:max-lg:block" : "sm:max-lg:hidden"
            } ${i < fill.lg ? "lg:block" : "lg:hidden"}`}
          />
        ))}
      </ul>
      {entries.every((e) => e.on) ? null : (
        <div className="border-t px-4 py-2">
          <button
            type="button"
            onClick={onShowAll}
            className="rounded-sm text-[0.8125rem] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Show all
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * The legend on the figures by fixture: the trend's, wired to the same `hide`
 * parameter the tools menu writes, so a tool hidden here is hidden everywhere.
 */
export const ToolLegend = ({
  tools,
  values = {},
  section,
  baseline,
}: {
  tools: readonly string[];
  /** Each tool's value on what the figure shows, formatted. */
  values?: { readonly [tool: string]: string | undefined };
  section: SectionId;
  baseline: string | null;
}) => {
  const { hidden, toggle, showAll } = useHidden(tools);
  return (
    <ChartLegend
      section={section}
      baseline={baseline}
      entries={tools.map((tool) => ({
        tool,
        on: !hidden.includes(tool),
        value: values[tool] ?? null,
      }))}
      onToggle={toggle}
      onShowAll={showAll}
    />
  );
};
