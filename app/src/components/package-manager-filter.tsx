import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Filter, FilterX, ChevronDown } from "lucide-react";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { cn } from "@/lib/utils";
import type { PackageManager } from "@/types/chart-data";

interface PackageManagerFilterProps {
  packageManagers: PackageManager[];
}

export const PackageManagerFilter = ({ packageManagers }: PackageManagerFilterProps) => {
  const {
    enabledPackageManagers,
    togglePackageManager,
    isPackageManagerEnabled,
    resetFilters,
    hasFilters
  } = usePackageManagerFilter();

  const [isOpen, setIsOpen] = useState(false);

  const enabledCount = enabledPackageManagers.size;
  const totalCount = packageManagers.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "font-medium text-sm gap-2 bg-white hover:bg-neutral-100 hover:text-foreground dark:hover:text-foreground border-[1px] dark:hover:bg-neutral-700 dark:bg-neutral-800 border-muted shadow-none",
            hasFilters && "border-primary text-primary"
          )}
        >
          {hasFilters ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          Tools
          <span className="text-xs text-muted-foreground">
            ({enabledCount}/{totalCount})
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Filter Tools
        </div>
        <DropdownMenuSeparator />

        {packageManagers.map((pm) => {
          const isEnabled = isPackageManagerEnabled(pm);

          return (
            <DropdownMenuItem
              key={pm}
              onClick={() => togglePackageManager(pm)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className={cn(
                "font-medium",
                !isEnabled && "text-muted-foreground line-through"
              )}>
                {pm}
              </span>
              <div className={cn(
                "w-4 h-4 rounded border-2 flex items-center justify-center",
                isEnabled
                  ? "bg-primary border-primary"
                  : "border-muted-foreground"
              )}>
                {isEnabled && (
                  <div className="w-2 h-2 bg-primary-foreground rounded-sm" />
                )}
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => resetFilters(packageManagers)}
          className="text-center justify-center font-medium text-muted-foreground hover:text-foreground"
        >
          Reset All Filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
