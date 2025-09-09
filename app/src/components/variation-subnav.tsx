import { Link, useLocation } from "react-router";
import { cn, getVariationCategories } from "@/lib/utils";
import { Leaderboard } from "@/components/leaderboard";
import { PackageTester } from "@/components/package-tester";
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
                    {/* Main grid: Left column (Package Management + Task Execution) | Right column (Leaderboard + Package Speed Tester) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      {/* Left column - Package Management + Task Execution */}
                      <div className="space-y-6">
                        {/* Package Management */}
                        <div className="space-y-3">
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

                          {/* Variation Explanations - Always visible */}
                          <div className="bg-muted/30 rounded-lg p-4">
                            <h4 className="text-sm font-medium mb-3">Installation Scenario Explanations</h4>
                            <div className="grid grid-cols-1 gap-3 text-xs">
                              <div>
                                <div className="font-medium text-foreground mb-1">Basic Scenarios</div>
                                <div className="space-y-1 text-muted-foreground">
                                  <div><span className="font-medium">clean:</span> Fresh install with no existing files</div>
                                  <div><span className="font-medium">node_modules:</span> Install with existing node_modules directory</div>
                                  <div><span className="font-medium">cache:</span> Install with populated package manager cache</div>
                                  <div><span className="font-medium">lockfile:</span> Install with existing lockfile (package-lock.json, etc.)</div>
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-foreground mb-1">Combined Scenarios</div>
                                <div className="space-y-1 text-muted-foreground">
                                  <div><span className="font-medium">cache+node_modules:</span> Both cache and existing modules</div>
                                  <div><span className="font-medium">cache+lockfile:</span> Both cache and lockfile present</div>
                                  <div><span className="font-medium">lockfile+node_modules:</span> Both lockfile and existing modules</div>
                                  <div><span className="font-medium">cache+lockfile+node_modules:</span> All components present</div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                              <div className="font-medium text-foreground mb-1">Why This Matters</div>
                              <div>Different scenarios test how package managers handle incremental installs, cache utilization, and dependency resolution when some components already exist.</div>
                            </div>
                          </div>
                        </div>

                        {/* Task Execution */}
                        <div className="space-y-4">
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
                      </div>

                      {/* Right column - Leaderboard + Package Speed Tester */}
                      <div className="space-y-6">
                        {/* Package Manager Rankings (Leaderboard) */}
                        <div>
                          <Leaderboard chartData={chartData} />
                        </div>

                        {/* Package Speed Tester */}
                        <div>
                          <PackageTester chartData={chartData} />
                        </div>
                      </div>
                    </div>
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
