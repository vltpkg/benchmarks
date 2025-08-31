import { useMemo } from "react";
import { calculateLeaderboard, getPackageManagerLogo } from "@/lib/utils";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { BenchmarkChartData } from "@/types/chart-data";

interface LeaderboardProps {
  chartData: BenchmarkChartData;
}

const TrendingIcon = () => {
  return (
    <svg
      data-testid="geist-icon"
      height="16"
      strokeLinejoin="round"
      viewBox="0 0 16 16"
      width="16"
      style={{ color: "currentcolor" }}
      className="flex-shrink-0"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.8242 3H10.0742V4.5H10.8242H13.4382L8.49989 9.43829L6.207 7.14629C5.81645 6.75589 5.18339 6.75595 4.79292 7.14642L0.719662 11.2197L0.189331 11.75L1.24999 12.8107L1.78032 12.2803L5.50009 8.56057L7.79298 10.8526C8.18353 11.243 8.81659 11.2429 9.20706 10.8524L14.4988 5.56066V8.17462V8.92462H15.9988V8.17462V4C15.9988 3.44772 15.5511 3 14.9988 3H10.8242Z"
        fill="currentColor"
      />
    </svg>
  );
};

const MedalIcon = ({ count, type }: { count: number; type: 'first' | 'second' | 'third' }) => {
  const colors = {
    first: 'text-yellow-500',
    second: 'text-gray-400',
    third: 'text-orange-600'
  };

  if (count === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs", colors[type])}>
      <div className="w-3 h-3 rounded-full bg-current" />
      <span className="font-medium">{count}</span>
    </div>
  );
};

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
          <TrendingIcon />
          <div>
            <h4 className="text-sm font-semibold">Package Manager Rankings</h4>
            <p className="text-xs text-muted-foreground">
              Average per-package performance across {totalScenarios} tests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>wins</span>
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
              {getPackageManagerLogo(item.packageManager, theme) && (
                <div className="flex-shrink-0">
                  <img
                    src={getPackageManagerLogo(item.packageManager, theme)}
                    alt={`${item.packageManager} logo`}
                    className={cn(
                      "w-6 h-6",
                      item.packageManager === 'vlt' && theme === 'dark' && "brightness-0 invert"
                    )}
                  />
                </div>
              )}

              {/* Superscript-style win indicator */}
              {item.wins > 0 && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                  {item.wins}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

