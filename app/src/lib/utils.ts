import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  Variation,
  Fixture,
  PackageManager,
  PackageManagerVersions,
  BenchmarkChartData,
  FixtureResult,
  PackageCountData,
} from "@/types/chart-data";

interface VariationCategory {
  title: string;
  description: string;
  variations: Variation[];
}

export const isTaskExecutionVariation = (variation: string): boolean => {
  const taskExecutionVariations = ["run"];
  return taskExecutionVariations.includes(variation);
};

export const isAverageVariation = (variation: string): boolean => {
  return variation === "average";
};

export const calculateAverageVariationData = (
  chartData: BenchmarkChartData,
  isPerPackage: boolean = false
): FixtureResult[] => {
  const dataSource = isPerPackage
    ? chartData.perPackageCountChartData.data
    : chartData.chartData.data;

  // Get package management variations (excluding "run" and "average")
  const packageManagementVariations = [
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules",
  ].filter(v => dataSource[v as Variation]);

  // Group data by fixture
  const fixtureGroups: Record<string, FixtureResult[]> = {};

  packageManagementVariations.forEach(variation => {
    const variationData = dataSource[variation as Variation];
    if (!variationData) return;

    variationData.forEach(fixtureResult => {
      const fixture = fixtureResult.fixture;
      if (!fixtureGroups[fixture]) {
        fixtureGroups[fixture] = [];
      }
      fixtureGroups[fixture].push(fixtureResult);
    });
  });

  // Calculate averages for each fixture
  const averagedResults: FixtureResult[] = [];

  Object.entries(fixtureGroups).forEach(([fixture, results]) => {
    const packageManagers = chartData.chartData.packageManagers;
    const averagedResult: FixtureResult = { fixture: fixture as Fixture };

    packageManagers.forEach(pm => {
      const values = results
        .map(r => r[pm])
        .filter((val): val is number => typeof val === "number" && val > 0);

      if (values.length > 0) {
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        averagedResult[pm] = average;

        // Copy fill color from first result
        const fillKey = `${pm}_fill` as keyof FixtureResult;
        if (results[0][fillKey]) {
          averagedResult[fillKey] = results[0][fillKey];
        }

        // Calculate average standard deviation if available
        const stddevKey = `${pm}_stddev` as keyof FixtureResult;
        const stddevValues = results
          .map(r => r[stddevKey])
          .filter((val): val is number => typeof val === "number" && val > 0);

        if (stddevValues.length > 0) {
          const avgStddev = stddevValues.reduce((sum, val) => sum + val, 0) / stddevValues.length;
          averagedResult[stddevKey] = avgStddev;
        }

        // For per-package data, also average the count if available
        if (isPerPackage) {
          const countKey = `${pm}_count` as keyof FixtureResult;
          const countValues = results
            .map(r => r[countKey])
            .filter((val): val is number => typeof val === "number" && val > 0);

          if (countValues.length > 0) {
            const avgCount = countValues.reduce((sum, val) => sum + val, 0) / countValues.length;
            averagedResult[countKey] = Math.round(avgCount);
          }
        }
      }
    });

    averagedResults.push(averagedResult);
  });

  return averagedResults;
};

export const getVariationCategories = (
  variations: Variation[],
): VariationCategory[] => {
  const packageManagementVariations = [
    "average",
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules",
  ].filter((v) => variations.includes(v as Variation)) as Variation[];

  const taskExecutionVariations = ["run"].filter((v) =>
    variations.includes(v as Variation),
  ) as Variation[];

  const categories: VariationCategory[] = [];

  if (packageManagementVariations.length > 0) {
    categories.push({
      title: "Package Management",
      description:
        "Installation scenarios with different cache and lockfile states",
      variations: sortVariations(packageManagementVariations),
    });
  }

  if (taskExecutionVariations.length > 0) {
    categories.push({
      title: "Task Execution",
      description: "Script and command execution performance",
      variations: sortVariations(taskExecutionVariations),
    });
  }

  return categories;
};

interface RankingData {
  packageManager: PackageManager;
  wins: number;
  averageTime: number;
  totalTests: number;
}

export const calculateLeaderboard = (
  chartData: BenchmarkChartData,
  specificVariation?: string,
): RankingData[] => {
  // Define package managers only (exclude tools like node, nx, turbo)
  const packageManagers = [
    "npm",
    "pnpm",
    "yarn",
    "berry",
    "bun",
    "deno",
    "vlt",
  ];
  const availablePackageManagers = chartData.chartData.packageManagers.filter(
    (pm: string) => packageManagers.includes(pm),
  ) as PackageManager[];

  const packageManagerStats: Partial<
    Record<
      PackageManager,
      { wins: number; totalTime: number; testCount: number }
    >
  > = {};

  // Initialize stats for package managers only
  availablePackageManagers.forEach((pm) => {
    packageManagerStats[pm] = { wins: 0, totalTime: 0, testCount: 0 };
  });

  // Get package management variations (excluding "run")
  let variationsToUse: string[];

  if (specificVariation && specificVariation !== "average") {
    // Use only the specific variation
    variationsToUse = [specificVariation];
  } else if (specificVariation === "average") {
    // For average, use all package management variations
    variationsToUse = getVariationCategories(chartData.chartData.variations).find(
      (cat) => cat.title === "Package Management",
    )?.variations.filter(v => v !== "average") || [];
  } else {
    // Default behavior - use all package management variations
    variationsToUse = getVariationCategories(chartData.chartData.variations).find(
      (cat) => cat.title === "Package Management",
    )?.variations.filter(v => v !== "average") || [];
  }

  // Calculate actual performance for each fixture and variation using per-package data
  variationsToUse.forEach((variation) => {
    const variationData = chartData.perPackageCountChartData.data[variation];
    if (!variationData) return;

    variationData.forEach((fixtureResult: FixtureResult) => {
      // Get all package manager times for this fixture (per-package timing)
      const times: Array<{ pm: PackageManager; time: number }> = [];

      availablePackageManagers.forEach((pm) => {
        const time = fixtureResult[pm];
        if (typeof time === "number" && time > 0) {
          times.push({ pm, time });
          // Add to total time and count
          const stats = packageManagerStats[pm];
          if (stats) {
            stats.totalTime += time;
            stats.testCount++;
          }
        }
      });

      // Sort by time to find winner (1st place)
      times.sort((a, b) => a.time - b.time);

      // Award win to fastest
      if (times.length > 0) {
        const winnerStats = packageManagerStats[times[0].pm];
        if (winnerStats) {
          winnerStats.wins++;
        }
      }
    });
  });

  // Calculate final rankings based on average performance
  const leaderboard: RankingData[] = availablePackageManagers.map((pm) => {
    const stats = packageManagerStats[pm];
    if (!stats) {
      return {
        packageManager: pm,
        wins: 0,
        averageTime: Number.MAX_SAFE_INTEGER,
        totalTests: 0,
      };
    }
    const averageTime =
      stats.testCount > 0
        ? stats.totalTime / stats.testCount
        : Number.MAX_SAFE_INTEGER;

    return {
      packageManager: pm,
      wins: stats.wins,
      averageTime,
      totalTests: stats.testCount,
    };
  });

  // Sort by average time (lower is better), then by wins as tiebreaker
  return leaderboard.sort((a, b) => {
    // Primary sort: average time (ascending - faster is better)
    if (a.averageTime !== b.averageTime) return a.averageTime - b.averageTime;
    // Tiebreaker: wins (descending - more wins is better)
    return b.wins - a.wins;
  });
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sortVariations(variations: Variation[]): Variation[] {
  const preferredOrder: Variation[] = [
    "average",
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules",
    "run",
  ];

  return variations.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);

    // If both are in preferred order, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only one is in preferred order, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // If neither is in preferred order, maintain original order
    return 0;
  });
}

export function sortFixtures(fixtures: Fixture[]): Fixture[] {
  const preferredOrder: Fixture[] = ["next", "vue", "svelte", "astro", "run"];

  return fixtures.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);

    // If both are in preferred order, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only one is in preferred order, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;

    // If neither is in preferred order, maintain original order
    return 0;
  });
}

export function formatPackageManagerLabel(
  packageManager: PackageManager,
  versions?: PackageManagerVersions,
): string {
  if (!versions || !versions[packageManager]) {
    return packageManager;
  }

  const version = versions[packageManager];
  // Remove 'v' prefix if it exists (like node's "v24.0.0"), then add it back consistently
  const cleanVersion = version?.startsWith("v") ? version.slice(1) : version;

  return `${packageManager} v${cleanVersion}`;
}

export function getPackageManagerVersion(
  packageManager: PackageManager,
  versions?: PackageManagerVersions,
): string | undefined {
  if (!versions || !versions[packageManager]) {
    return undefined;
  }

  const version = versions[packageManager];
  // Remove 'v' prefix if it exists (like node's "v24.0.0"), then add it back consistently
  const cleanVersion = version?.startsWith("v") ? version.slice(1) : version;

  return `v${cleanVersion}`;
}

// Deep linking utilities
export function createSectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function parseFiltersFromURL(): {
  packageManagers?: string[];
} {
  const urlParams = new URLSearchParams(window.location.search);
  const result: { packageManagers?: string[] } = {};

  const tools = urlParams.get("tools");
  if (tools) {
    result.packageManagers = tools.split(",").filter(Boolean);
  }

  return result;
}

export function updateURLWithFilters(
  enabledPackageManagers: Set<string>,
): void {
  const url = new URL(window.location.href);

  // Update package managers filter
  if (enabledPackageManagers.size > 0) {
    url.searchParams.set("tools", Array.from(enabledPackageManagers).join(","));
  } else {
    url.searchParams.delete("tools");
  }

  // Update URL without reloading
  window.history.replaceState({}, "", url.toString());
}

export function scrollToSection(sectionId: string, offset: number = 80): void {
  const element = document.getElementById(sectionId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
}

export function getFixtureId(fixture: string): string {
  return fixture.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export const getAvailablePackageManagers = (
  variationData: FixtureResult[],
  allPackageManagers: PackageManager[],
): PackageManager[] => {
  const availablePackageManagers = new Set<PackageManager>();

  variationData.forEach((fixtureResult) => {
    allPackageManagers.forEach((pm) => {
      const value = fixtureResult[pm];
      // Check if the package manager has valid data (not undefined, null, or 0)
      if (
        value !== undefined &&
        value !== null &&
        typeof value === "number" &&
        value > 0
      ) {
        availablePackageManagers.add(pm);
      }
    });
  });

  return allPackageManagers.filter((pm) => availablePackageManagers.has(pm));
};

export const getAvailablePackageManagersFromPackageCount = (
  packageCountData: Array<{ packageCounts?: PackageCountData }>,
  allPackageManagers: PackageManager[],
): PackageManager[] => {
  const availablePackageManagers = new Set<PackageManager>();

  packageCountData.forEach((item) => {
    if (item.packageCounts) {
      allPackageManagers.forEach((pm) => {
        const entry = item.packageCounts?.[pm as keyof PackageCountData];
        // Check if the package manager has valid data (entry exists and has count > 0)
        if (
          entry &&
          typeof entry === "object" &&
          entry.count &&
          entry.count > 0
        ) {
          availablePackageManagers.add(pm);
        }
      });
    }
  });

  return allPackageManagers.filter((pm) => availablePackageManagers.has(pm));
};
