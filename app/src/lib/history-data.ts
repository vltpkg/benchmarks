export const PACKAGE_MANAGERS = [
  "npm",
  "yarn",
  "pnpm",
  "pacquet",
  "berry",
  "zpm",
  "deno",
  "bun",
  "vlt",
  "aube",
  "nx",
  "turbo",
  "vp",
  "node",
  "aws",
  "cloudsmith",
  "github",
  "jfrog",
];

type FixtureDataSet = Record<
  string,
  Array<Record<string, number | string> & { fixture: string }>
>;

export interface ChartDataResponse {
  date: string;
  chartData: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
  perPackageCountChartData?: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
  registryChartData?: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
  registryPerPackageCountChartData?: {
    variations: string[];
    data: FixtureDataSet;
    packageManagers: string[];
  };
}

/**
 * Extract per-PM averages (across fixtures) for each variation from a single
 * day's chart-data.json response.
 *
 * For package-management variations (clean, cache, lockfile, etc.) we use
 * perPackageCountChartData when available — these values are already in ms/pkg
 * and match what the leaderboard cards display.  Falls back to total-time
 * chartData for older files that lack per-package data.
 *
 * Registry variations use total-time data, including legacy totals in chartData.
 * Per-package-only registry history is omitted rather than mislabeled as seconds.
 */
export function extractDayData(
  response: ChartDataResponse,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};

  // Use per-package data for package-management variations when available,
  // otherwise fall back to total-time chartData
  const pmSource =
    response.perPackageCountChartData?.data ?? response.chartData?.data ?? {};
  extractFromDataSet(
    Object.fromEntries(
      Object.entries(pmSource).filter(
        ([variation]) => !variation.startsWith("registry-"),
      ),
    ),
    result,
  );

  // Registry history is labeled in seconds. Older files may contain registry
  // totals in chartData rather than a dedicated registryChartData dataset.
  // Normalized ms/package data cannot serve as a seconds fallback.
  const registrySource = {
    ...response.chartData?.data,
    ...response.registryChartData?.data,
  };
  extractFromDataSet(
    Object.fromEntries(
      Object.entries(registrySource).filter(([variation]) =>
        variation.startsWith("registry-"),
      ),
    ),
    result,
  );

  return result;
}

function extractFromDataSet(
  data: Record<
    string,
    Array<Record<string, number | string> & { fixture: string }>
  >,
  result: Record<string, Record<string, number>>,
): void {
  for (const [variation, fixtures] of Object.entries(data)) {
    if (!Array.isArray(fixtures) || fixtures.length === 0) continue;

    const pmTotals: Record<string, { sum: number; count: number }> = {};

    for (const fixture of fixtures) {
      for (const pm of PACKAGE_MANAGERS) {
        const val = fixture[pm];
        if (typeof val === "number" && Number.isFinite(val)) {
          if (!pmTotals[pm]) pmTotals[pm] = { sum: 0, count: 0 };
          pmTotals[pm].sum += val;
          pmTotals[pm].count++;
        }
      }
    }

    const pmAverages: Record<string, number> = {};
    for (const [pm, { sum, count }] of Object.entries(pmTotals)) {
      pmAverages[pm] = Math.round((sum / count) * 1000) / 1000;
    }

    if (Object.keys(pmAverages).length > 0) {
      result[variation] = pmAverages;
    }
  }
}
