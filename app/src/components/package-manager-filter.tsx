import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ListFilter, Check, ChevronRight } from "lucide-react";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";

import type { PackageManager } from "@/types/chart-data";

interface PackageManagerFilterProps {
  packageManagers: PackageManager[];
}

export const PackageManagerFilter = ({
  packageManagers,
}: PackageManagerFilterProps) => {
  const {
    enabledPackageManagers,
    togglePackageManager,
    isPackageManagerEnabled,
    resetFilters,
    hasFilters,
  } = usePackageManagerFilter();

  const [isOpen, setIsOpen] = useState(false);

  const enabledCount = enabledPackageManagers.size;
  const totalCount = packageManagers.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        asChild
        className="rounded-lg dark:border-neutral-700 dark:hover:border-neutral-600 border hover:border-neutral-300 border-neutral-200 shadow-none bg-neutral-100 hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-neutral-800 text-black dark:text-white w-[147px]"
      >
        <Button size="sm">
          <ListFilter />
          Tools
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
        className="w-48 rounded-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {packageManagers.map((pm) => {
          const isEnabled = isPackageManagerEnabled(pm);

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
              <span>{pm}</span>
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
