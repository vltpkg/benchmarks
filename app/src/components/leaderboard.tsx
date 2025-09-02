import { useMemo } from "react";
import { calculateLeaderboard, getPackageManagerLogo } from "@/lib/utils";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { BenchmarkChartData } from "@/types/chart-data";

interface LeaderboardProps {
  chartData: BenchmarkChartData;
}

export const Leaderboard = ({ chartData }: LeaderboardProps) => {
  const { enabledPackageManagers } = usePackageManagerFilter();
  const { theme } = useTheme();

  const leaderboard = useMemo(() => {
    const fullLeaderboard = calculateLeaderboard(chartData);
    // Filter to only show enabled package managers (but don't limit count since we're only showing package managers now)
    return fullLeaderboard.filter(item => enabledPackageManagers.has(item.packageManager));
  }, [chartData, enabledPackageManagers]);

  if (leaderboard.length === 0) return null;

  // Calculate total scenarios for context
    const totalScenarios = leaderboard.length > 0 ? leaderboard[0].totalTests : 0;

  return (
    <div className="bg-card/50 border border-border/50 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div>
            <h4 className="text-sm font-semibold">Package Manager Rankings</h4>
            <p className="text-xs text-muted-foreground">
              Average per-package performance across {totalScenarios} tests
            </p>
          </div>
        </div>
      </div>

      {/* Flexible grid layout for tools */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {leaderboard.map((item, index) => {
          const rank = index + 1;

          return (
                        <div
              key={item.packageManager}
              className="relative flex items-center gap-2 p-2 rounded border border-border/50 hover:bg-accent/30 transition-colors"
            >
              {/* Rank on the left - vertically centered */}
              <div className="text-base text-muted-foreground font-bold flex-shrink-0 px-3">
                {rank}
              </div>

                                   {/* Tool name and average - left aligned */}
                     <div className="flex-1">
                       <div className="text-sm font-medium">{item.packageManager}</div>
                       <div className="text-xs text-muted-foreground">
                         {item.averageTime.toFixed(1)}ms/pkg
                       </div>
                     </div>

              {/* Package manager logo - right aligned for balance */}
              {getPackageManagerLogo(item.packageManager, theme === 'system' ? 'light' : theme) && (
                <div className="flex-shrink-0">
                  <img
                    src={getPackageManagerLogo(item.packageManager, theme === 'system' ? 'light' : theme)}
                    alt={`${item.packageManager} logo`}
                    className={cn(
                      "w-6 h-6",
                      item.packageManager === 'vlt' && theme === 'dark' && "brightness-0 invert"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

