import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn, sortVariations } from "@/lib/utils";
import type { BenchmarkChartData, Variation } from "@/types/chart-data";

const BarChartIcon = () => (
  <svg
    data-testid="geist-icon"
    height="20"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="20"
    style={{ color: "currentcolor" }}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 1v11.75A2.25 2.25 0 0 0 3.25 15H15v-1.5H3.25a.75.75 0 0 1-.75-.75V1H1Zm8.5 2.75V3H8v9h1.5V3.75ZM6 8v4H4.5V8H6Zm7-1.25V6h-1.5v6H13V6.75Z"
      clipRule="evenodd"
    />
  </svg>
);

interface HeaderProps {
  chartData: BenchmarkChartData | null;
}

export const Header = ({ chartData }: HeaderProps) => {
  const location = useLocation();
  const sortedVariations = chartData ? sortVariations([...chartData.chartData.variations]) : [];
  const currentVariation =
    location.pathname.slice(1) || sortedVariations[0];

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BarChartIcon />
              Benchmarks
              {location.pathname !== "/" && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  / {location.pathname.slice(1)}
                </span>
              )}
            </h1>
          </div>

          {chartData && (
            <nav role="navigation" aria-label="Benchmark variations" className="md:hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Fixture:
                </span>
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
                  {sortedVariations.map(
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
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
