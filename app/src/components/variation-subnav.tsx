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
          {/* Package Management with Leaderboard */}
          {(() => {
            const packageManagement = categories.find(cat => cat.title === "Package Management");
            const otherCategories = categories.filter(cat => cat.title !== "Package Management");

            return (
              <>
                {packageManagement && (
                  <div className="space-y-4">
                    {/* Package Management with 40/60 split */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                      {/* Left side - Variation links (40%) */}
                      <div className="lg:col-span-2 space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {packageManagement.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {packageManagement.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {packageManagement.variations.map((variation) => {
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

                                                                  {/* Right side - Leaderboard (60%) */}
                      <div className="lg:col-span-3">
                        <Leaderboard chartData={chartData} />
                      </div>
                    </div>

                    {/* Task Execution directly below */}
                    {otherCategories.map((category) => (
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
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
