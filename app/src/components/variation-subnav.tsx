import { Link, useLocation } from "react-router";
import { cn, getVariationCategories } from "@/lib/utils";
import { Leaderboard } from "@/components/leaderboard";
import type { BenchmarkChartData } from "@/types/chart-data";

interface VariationSubnavProps {
  chartData: BenchmarkChartData | null;
}

export const VariationSubnav = ({ chartData }: VariationSubnavProps) => {
  const location = useLocation();

  if (!chartData) return null;

  const categories = getVariationCategories(chartData.chartData.variations);

                return (
    <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="space-y-6">
          {/* Variation Categories */}
          {categories.map((category) => (
            <div key={category.title} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {category.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {category.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {category.variations.map((variation) => {
                  const isActive = location.pathname === `/${variation}`;

                  return (
                    <Link
                      key={variation}
                      to={`/${variation}`}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                        "border border-border/50 hover:border-border",
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {variation}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Horizontal Leaderboard */}
          <Leaderboard chartData={chartData} />
        </div>
      </div>
    </div>
  );
};
