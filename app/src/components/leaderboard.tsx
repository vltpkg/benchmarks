import { useMemo } from "react";
import { calculateLeaderboard } from "@/lib/utils";
import { usePackageManagerFilter } from "@/contexts/package-manager-filter-context";
import { cn } from "@/lib/utils";
import type { BenchmarkChartData } from "@/types/chart-data";

interface LeaderboardProps {
  chartData: BenchmarkChartData;
}

const TrophyIcon = ({ rank }: { rank: number }) => {
  const color = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : "#CD7F32";

  return (
    <svg
      height="20"
      width="20"
      viewBox="0 0 24 24"
      fill="none"
      className="flex-shrink-0"
    >
      <path
        d="M6 9C6 5.686 8.686 3 12 3s6 2.686 6 6v2c0 1.627-.623 3.11-1.642 4.235L17 16l1 3H6l1-1.765C6.623 16.11 6 14.627 6 13V9z"
        fill={color}
      />
      <rect x="9" y="19" width="6" height="2" fill={color} />
      <rect x="8" y="21" width="8" height="1" fill={color} />
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

  const leaderboard = useMemo(() => {
    const fullLeaderboard = calculateLeaderboard(chartData);
    // Filter to only show enabled package managers (but don't limit count since we're only showing package managers now)
    return fullLeaderboard.filter(item => enabledPackageManagers.has(item.packageManager));
  }, [chartData, enabledPackageManagers]);

  if (leaderboard.length === 0) return null;

  // Calculate total scenarios for context
  const totalScenarios = leaderboard.length > 0 ? leaderboard[0].totalRanks : 0;

        return (
    <div className="bg-card/50 border border-border/50 rounded-lg p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrophyIcon rank={1} />
          <div>
            <h4 className="text-sm font-semibold">Package Manager Rankings</h4>
            <p className="text-xs text-muted-foreground">
              Average position across {totalScenarios} scenarios
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>wins</span>
        </div>
      </div>

      {/* Horizontal grid for tools */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {leaderboard.map((item, index) => {
          const rank = index + 1;

          return (
                        <div
              key={item.packageManager}
              className="relative flex items-center gap-2 p-2 rounded border border-border/50 hover:bg-accent/30 transition-colors"
            >
              {/* Rank on the left - vertically centered */}
              <div className="text-xs text-muted-foreground font-medium flex-shrink-0">
                #{rank}
              </div>

              {/* Tool name and average - left aligned */}
              <div className="flex-1">
                <div className="text-sm font-medium">{item.packageManager}</div>
                <div className="text-xs text-muted-foreground">
                  {item.averageRank.toFixed(1)} avg
                </div>
              </div>

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

