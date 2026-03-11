import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronRight, Hammer } from "lucide-react";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { getPackageManagerDisplayName } from "@/lib/utils";
import { resolveTheme, useTheme } from "@/components/theme-provider";

import type { PackageManager, ColorMap } from "@/types/chart-data";

interface PackageManagerFilterProps {
  packageManagers: PackageManager[];
  colors?: ColorMap;
}

export const PackageManagerFilter = ({
  packageManagers,
  colors,
}: PackageManagerFilterProps) => {
  const {
    enabledPackageManagers,
    togglePackageManager,
    isPackageManagerEnabled,
    resetFilters,
  } = usePackageManagerFilter();

  const { theme } = useTheme();
  const resolvedTheme = resolveTheme(theme);
  const [isOpen, setIsOpen] = useState(false);

  const getColor = (pm: PackageManager) => {
    if (!colors) return undefined;
    return pm === "vlt" && resolvedTheme === "dark" ? "white" : colors[pm];
  };

  const enabledCount = packageManagers.filter((pm) =>
    enabledPackageManagers.has(pm),
  ).length;
  const totalCount = packageManagers.length;
  const hasFilters = enabledCount !== totalCount;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        asChild
        className="rounded-lg dark:border-neutral-700 dark:hover:border-neutral-600 border hover:border-neutral-300 border-neutral-200 shadow-none bg-neutral-100 hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-neutral-800 text-black dark:text-white min-w-0 w-auto"
      >
        <Button size="sm" className="text-xs md:text-sm">
          <Hammer className="flex-shrink-0" />
          Tools
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ({enabledCount}/{totalCount})
          </span>
          <ChevronRight
            data-id="chevron"
            className="transition-transform duration-150 text-muted-foreground flex-shrink-0"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-48 rounded-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {packageManagers.map((pm) => {
          const isEnabled = isPackageManagerEnabled(pm);
          const displayName = getPackageManagerDisplayName(pm);

          return (
            <DropdownMenuItem
              key={pm}
              onClick={() => togglePackageManager(pm)}
              onSelect={(e) => e.preventDefault()}
              className="flex gap-2 dark:text-foreground text-foreground font-medium items-center cursor-default"
            >
              <div className="items-center flex justify-center size-5">
                {isEnabled && (
                  <Check className="text-foreground dark:text-foreground" />
                )}
              </div>
              {colors && (
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getColor(pm) }}
                />
              )}
              <span>{displayName}</span>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          disabled={!hasFilters}
          onClick={() => resetFilters(packageManagers)}
          className="transition-colors duration-150 cursor-default justify-center font-medium dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-foreground"
        >
          Clear all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
