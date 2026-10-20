"use client";

import { ChevronDown, FolderCode } from "lucide-react";
import { useQueryState } from "nuqs";
import { usePending } from "@/components/report-pending";
import { FixtureName } from "@/components/tool-name";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reportParams } from "@/lib/params";
import { cn } from "@/lib/utils";

/* The selected fixture: the hover surface held, the label at full ink where its siblings are muted. */
const current = (active: boolean): string =>
  active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground";

/**
 * Which fixture the numbers are for, in the page's first row: the fixtures
 * the scenario published, or all of them, averaged. `fixture` is a
 * SERVER parameter, so the write is not shallow: the page re-renders, the
 * sidebar around it does not. A value the scenario did not publish reads as
 * all fixtures, as the page reads it.
 */
export const FixtureMenu = ({
  fixtures,
  className,
}: {
  fixtures: readonly string[];
  className?: string;
}) => {
  const { startTransition } = usePending();
  const [value, setValue] = useQueryState("fixture", {
    ...reportParams.fixture,
    shallow: false,
    startTransition,
  });
  const fixture = value !== null && fixtures.includes(value) ? value : null;
  const options = [null, ...fixtures];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start font-normal", className)}>
          {/* The selected fixture's own mark leads; with all of them selected, a generic one holds the place. */}
          {fixture === null ? <FolderCode aria-hidden className="text-muted-foreground" /> : null}
          <span className="sr-only">Fixture: </span>
          <span className="min-w-0 truncate">
            {fixture === null ? "All fixtures" : <FixtureName fixture={fixture} />}
          </span>
          <ChevronDown aria-hidden className="ml-auto text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[13rem]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Fixture
        </DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem
            key={option ?? "all"}
            aria-current={option === fixture ? "true" : undefined}
            className={current(option === fixture)}
            onSelect={() => void setValue(option)}
          >
            {option === null ? "All fixtures (mean)" : <FixtureName fixture={option} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
