import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Check } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import type { Variation } from "@/types/chart-data";

export const VariationDropdown = ({
  sortedVariations,
  currentVariation,
}: {
  sortedVariations: Variation[];
  currentVariation: Variation;
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="md:hidden rounded-lg dark:border-neutral-700 dark:hover:border-neutral-600 border hover:border-neutral-300 border-neutral-200 shadow-none bg-neutral-100 hover:bg-neutral-200 [&[data-state=open]>svg[data-id=chevron]]:rotate-90 dark:hover:bg-neutral-700 dark:bg-neutral-800 text-black dark:text-white w-fit max-w-full"
        >
          Fixture
          <span className="text-xs text-muted-foreground max-w-12 truncate">
            {currentVariation}
          </span>
          <ChevronRight
            data-id="chevron"
            className="transition-transform duration-150 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {sortedVariations.map((variation: Variation) => (
          <DropdownMenuItem
            key={variation}
            onClick={() => {
              const base =
                location.pathname.split("/")[1] || "package-managers";
              navigate(`/${base}/${variation}`);
            }}
          >
            <div className="items-center justify-center flex size-5">
              {variation === currentVariation && (
                <Check className="text-foreground dark:text-foreground" />
              )}
            </div>
            <span>{variation}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
