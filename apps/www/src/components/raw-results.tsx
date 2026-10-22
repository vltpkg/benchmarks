"use client";

import type { ReactNode } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ChevronDown, ExternalLink, SearchIcon } from "lucide-react";
import { FixtureName } from "@/components/tool-name";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fixtureLabel } from "@/lib/tools";

type RawFile = {
  readonly fixture: string;
  readonly scenario: string;
  readonly href: string;
};

/* Every word typed is in the fixture's or the scenario's name: cmdk's fuzzy
   default also matched letters scattered through the URL. */
const matches = (_value: string, search: string, keywords: string[] = []) => {
  const names = keywords.join(" ").toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .every((word) => names.includes(word))
    ? 1
    : 0;
};

/**
 * Data and source: the raw result files behind this page, at the end of the
 * content column -- the very URLs the page fetched to draw itself, so each one
 * resolves. A filterable list, grouped by fixture, each file named by its
 * scenario; a scenario's own page has one file per fixture, so there the
 * fixtures are the list. Each row is a real link (open in a new tab, copy its
 * address); Enter opens the highlighted one.
 */
export const DataAndSource = ({ raw = [] }: { raw?: readonly RawFile[] }) => {
  if (raw.length === 0) return null;
  const groups = new Map<string, RawFile[]>();
  for (const file of raw) groups.set(file.fixture, [...(groups.get(file.fixture) ?? []), file]);
  const grouped = [...groups.values()].some((files) => files.length > 1);
  const item = (file: RawFile, label: ReactNode) => (
    <CommandItem
      key={file.href}
      value={file.href}
      keywords={[fixtureLabel(file.fixture), file.scenario]}
      onSelect={() => window.open(file.href, "_blank", "noopener,noreferrer")}
      className="min-h-8 p-0 [&>svg:last-child]:hidden"
    >
      {/* the link handles a pointer itself, so a click opens one tab, not two */}
      <a
        href={file.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-8 flex-1 items-center gap-2 px-2"
      >
        {label}
        <span className="sr-only"> (JSON, opens in a new tab)</span>
        <ExternalLink aria-hidden className="ml-auto size-3.5 text-muted-foreground" />
      </a>
    </CommandItem>
  );
  return (
    <nav aria-labelledby="data-and-source" className="mt-24 min-w-0 data-mode:mt-12">
      <h2 id="data-and-source" className="sr-only">
        Data and source
      </h2>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="font-normal">
            Raw results (JSON)
            <ChevronDown aria-hidden className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command filter={matches}>
            <div className="flex h-9 items-center gap-2 border-b px-2 text-muted-foreground [&_svg]:size-4">
              <SearchIcon aria-hidden />
              <CommandPrimitive.Input
                placeholder={grouped ? "Filter fixtures and scenarios" : "Filter fixtures"}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
              />
            </div>
            <CommandList className="max-h-80 overflow-y-auto">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                No result files match.
              </CommandEmpty>
              {grouped ? (
                [...groups].map(([fixture, files]) => (
                  <CommandGroup key={fixture} heading={<FixtureName fixture={fixture} />}>
                    {files.map((file) =>
                      item(file, <span className="font-mono text-xs">{file.scenario}</span>),
                    )}
                  </CommandGroup>
                ))
              ) : (
                <CommandGroup>
                  {raw.map((file) => item(file, <FixtureName fixture={file.fixture} />))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </nav>
  );
};
