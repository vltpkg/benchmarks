import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BenchmarkChartData, Variation } from "@/types/chart-data";
import { DATE_YEAR, DATE_MONTH, DATE_DAY } from "@/constants";

interface HeaderProps {
  chartData: BenchmarkChartData | null;
}

export const Header = ({ chartData }: HeaderProps) => {
  const location = useLocation();
  const currentVariation =
    location.pathname.slice(1) || chartData?.chartData.variations[0];

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Benchmarks
              {location.pathname !== "/" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  / {location.pathname.slice(1)}
                </span>
              )}
            </h1>
            {chartData && (
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Results from {DATE_YEAR}-{DATE_MONTH}-{DATE_DAY}
              </p>
            )}
          </div>

          {chartData && (
            <nav role="navigation" aria-label="Benchmark variations">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-medium text-sm gap-2 bg-white hover:bg-neutral-100 hover:text-foreground dark:hover:text-foreground border-[1px] dark:hover:bg-neutral-700 dark:bg-neutral-800 border-muted shadow-none"
                  >
                    {currentVariation}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {chartData.chartData.variations.map(
                    (variation: Variation) => (
                      <DropdownMenuItem key={variation} asChild>
                        <Link
                          to={`/${variation}`}
                          className={cn(
                            "w-full dark:hover:text-foreground/80 dark:hover:bg-neutral-800",
                            location.pathname === `/${variation}` &&
                              "text-primary",
                          )}
                        >
                          {variation}
                        </Link>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
