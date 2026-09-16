import type {
  BenchmarkChartData,
  Fixture,
  PackageManager,
  Variation,
} from "@/types/chart-data";

export interface RegistryRanking {
  packageManager: PackageManager;
  wins: number;
  totalTests: number;
  completedTests: number;
}

/** Each selected fixture/variation is one contest, independent of its duration. */
export function calculateRegistryLeaderboard(
  chartData: BenchmarkChartData,
  specificVariation?: Variation,
  enabledFixtures?: Set<Fixture>,
): RegistryRanking[] {
  const source = chartData.registryChartData;
  if (!source) return [];
  const variations =
    specificVariation && specificVariation !== "average"
      ? [specificVariation]
      : source.variations.filter((variation) => variation !== "average");
  const rankings = source.packageManagers.map((packageManager) => ({
    packageManager,
    wins: 0,
    totalTests: 0,
    completedTests: 0,
  }));

  for (const variation of variations) {
    for (const fixture of source.data[variation] ?? []) {
      if (enabledFixtures && !enabledFixtures.has(fixture.fixture)) continue;
      // Missing, DNF and partial samples never earn wins. Preserve a common
      // denominator even when a registry failed or the whole contest failed.
      const metadata = fixture as typeof fixture & Record<string, unknown>;
      const times = rankings.map(({ packageManager: pm }) => {
        const value = fixture[pm];
        return metadata[`${pm}_dnf`] !== true &&
          metadata[`${pm}_partial`] !== true &&
          typeof value === "number" &&
          Number.isFinite(value) &&
          value > 0
          ? value
          : undefined;
      });
      const best = Math.min(...times.filter((time) => time !== undefined));
      rankings.forEach((ranking, index) => {
        ranking.totalTests++;
        const time = times[index];
        if (time === undefined) return;
        ranking.completedTests++;
        // Exact ties each receive a win; no registry gets arbitrary priority.
        if (time === best) ranking.wins++;
      });
    }
  }

  return rankings
    .filter((ranking) => ranking.totalTests > 0)
    .sort(
      (a, b) =>
        b.wins - a.wins || a.packageManager.localeCompare(b.packageManager),
    );
}
