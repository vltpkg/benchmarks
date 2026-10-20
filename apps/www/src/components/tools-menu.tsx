"use client";

import { Boxes, ChevronDown, Server, SquareTerminal } from "lucide-react";
import { useQueryState } from "nuqs";
import { usePending } from "@/components/report-pending";
import { ToolName } from "@/components/tool-name";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toolColor } from "@/lib/chart-model";
import { reportParams } from "@/lib/params";
import type { SectionId } from "@/lib/sections";
import { cn } from "@/lib/utils";

/** What the tools are called on each benchmark: the same control lists registries there. */
const NOUN: { readonly [S in SectionId]: string } = {
  "package-managers": "package managers",
  registries: "registries",
  "task-runners": "task runners",
};

/** Each benchmark's mark for its tools, leading the trigger so it is told
 *  apart from the fixture menu beside it at a glance. */
const ICON: { readonly [S in SectionId]: typeof Boxes } = {
  "package-managers": Boxes,
  registries: Server,
  "task-runners": SquareTerminal,
};

/**
 * Which tools the page shows: the multi-select under the page's title, where the previous
 * app had its package-manager filter (tmp/app/src/components/
 * package-manager-filter.tsx) -- check items, select all, clear.
 *
 * ONE PARAMETER, `hide`, and it is the same one the trend legend's entries
 * toggle, so the menu and the legend cannot disagree. It lists what is hidden
 * rather than what is shown so that the default -- everything -- is an empty
 * list and stays out of the URL, and so that a tool published tomorrow is
 * shown without anyone's saved link having to name it.
 *
 * It is a SERVER parameter: hidden tools leave the tables and the bars, which
 * the server shapes. So the write is not shallow.
 *
 * A name in the URL that this scenario's files do not contain hides nothing.
 */
export const useHidden = (tools: readonly string[]) => {
  const { startToolsTransition } = usePending();
  const [hide, setHide] = useQueryState("hide", {
    ...reportParams.hide,
    shallow: false,
    startTransition: startToolsTransition,
  });
  const hidden = hide.filter((tool) => tools.includes(tool));
  return {
    hidden,
    toggle: (tool: string) =>
      void setHide(hidden.includes(tool) ? hidden.filter((t) => t !== tool) : [...hidden, tool]),
    showAll: () => void setHide([]),
    hideAllBut: (keep: readonly string[]) => void setHide(tools.filter((t) => !keep.includes(t))),
  };
};

/** The checkable entries. */
const ToolsMenuItems = ({ tools, section }: { tools: readonly string[]; section: SectionId }) => {
  const { hidden, toggle, showAll, hideAllBut } = useHidden(tools);
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground capitalize">
        {NOUN[section]}
      </DropdownMenuLabel>
      {tools.map((tool) => (
        <DropdownMenuCheckboxItem
          key={tool}
          checked={!hidden.includes(tool)}
          onCheckedChange={() => toggle(tool)}
          /* Stay open: this is a multi-select, and closing on every tick
             would make choosing three tools three trips. */
          onSelect={(event) => event.preventDefault()}
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: toolColor(tool) }}
          />
          <ToolName tool={tool} section={section} />
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={hidden.length === 0}
        onSelect={(event) => {
          event.preventDefault();
          showAll();
        }}
      >
        Select all
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={hidden.length === tools.length}
        onSelect={(event) => {
          event.preventDefault();
          hideAllBut([]);
        }}
      >
        Clear
      </DropdownMenuItem>
    </>
  );
};

export const ToolsMenu = ({
  tools,
  section,
  className,
}: {
  /** Every tool this scenario's files contain, in ranking order. */
  tools: readonly string[];
  section: SectionId;
  className?: string;
}) => {
  const { hidden } = useHidden(tools);
  const shown = tools.length - hidden.length;
  const Icon = ICON[section];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* A fixed width from the caller, so ticking a tool does not
            resize the button and shove its neighbour along the row. */}
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-start font-normal tabular-nums", className)}
        >
          <Icon aria-hidden className="text-muted-foreground" />
          <span className="sr-only">Showing: </span>
          <span className="min-w-0 truncate">
            {hidden.length === 0 ? "All" : `${shown} of ${tools.length}`} {NOUN[section]}
          </span>
          <ChevronDown aria-hidden className="ml-auto text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <ToolsMenuItems tools={tools} section={section} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** Undoes every hidden tool, as the menu's "Select all" does: the lines come back at once. */
export const ShowAllTools = ({ className }: { className?: string }) => {
  const { showAll } = useHidden([]);
  return (
    <button type="button" onClick={showAll} className={className}>
      Show all
    </button>
  );
};
