import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { useFixtureFilter } from "@/contexts/fixture-filter-context";
import { getFixtureDisplayName } from "@/lib/utils";
import { getFrameworkIcon } from "@/lib/get-icons";
import { Package } from "@/components/icons";

import type { Fixture } from "@/types/chart-data";

interface FixtureFilterProps {
  fixtures: Fixture[];
}

export const FixtureFilter = ({ fixtures }: FixtureFilterProps) => {
  const { enabledFixtures, toggleFixture, isFixtureEnabled, resetFilters } =
    useFixtureFilter();

  const [isOpen, setIsOpen] = useState(false);

  const enabledCount = fixtures.filter((fixture) =>
    enabledFixtures.has(fixture),
  ).length;
  const totalCount = fixtures.length;
  const hasFilters = enabledCount !== totalCount;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        asChild
        className="rounded-lg dark:border-neutral-700 dark:hover:border-neutral-600 border hover:border-neutral-300 border-neutral-200 shadow-none bg-neutral-100 hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-neutral-800 text-black dark:text-white w-[150px]"
      >
        <Button size="sm">
          <Package />
          Fixtures
          <span className="text-xs text-muted-foreground">
            ({enabledCount}/{totalCount})
          </span>
          <ChevronRight
            data-id="chevron"
            className="transition-transform duration-150 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 rounded-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {fixtures.map((fixture) => {
          const isEnabled = isFixtureEnabled(fixture);
          const displayName = getFixtureDisplayName(fixture);
          const Icon = getFrameworkIcon(fixture);

          return (
            <DropdownMenuItem
              key={fixture}
              onClick={() => toggleFixture(fixture)}
              onSelect={(e) => e.preventDefault()}
              className="flex gap-2 dark:text-foreground text-foreground font-medium items-center cursor-default"
            >
              <div className="items-center flex justify-center size-5">
                {isEnabled && (
                  <Check className="text-foreground dark:text-foreground" />
                )}
              </div>
              <div className="items-center flex justify-center size-4">
                {Icon && <Icon className="text-muted-foreground" />}
              </div>
              <span>{displayName}</span>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          disabled={!hasFilters}
          onClick={() => resetFilters(fixtures)}
          className="transition-colors duration-150 cursor-default justify-center font-medium dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-foreground"
        >
          Clear all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
