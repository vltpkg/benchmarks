export type PackageManager =
  | "npm"
  | "yarn"
  | "pnpm"
  | "berry"
  | "deno"
  | "bun"
  | "vlt"
  | "nx"
  | "turbo"
  | "node";

export type Fixture = "next" | "astro" | "svelte" | "vue" | "large" | "run";

export type Variation =
  | "average"
  | "cache"
  | "cache+lockfile"
  | "cache+lockfile+node_modules"
  | "cache+node_modules"
  | "clean"
  | "lockfile"
  | "lockfile+node_modules"
  | "node_modules"
  | "run";

export type ColorMap = Record<PackageManager, string>;

export interface PackageManagerVersions {
  npm?: string;
  yarn?: string;
  pnpm?: string;
  berry?: string;
  deno?: string;
  bun?: string;
  vlt?: string;
  nx?: string;
  turbo?: string;
  node?: string;
}

export interface BaseFixtureResult {
  fixture: Fixture;
}

export interface PackageManagerData {
  npm?: number;
  yarn?: number;
  pnpm?: number;
  berry?: number;
  deno?: number;
  bun?: number;
  vlt?: number;
  nx?: number;
  turbo?: number;
  node?: number;

  npm_stddev?: number;
  yarn_stddev?: number;
  pnpm_stddev?: number;
  berry_stddev?: number;
  deno_stddev?: number;
  bun_stddev?: number;
  vlt_stddev?: number;
  nx_stddev?: number;
  turbo_stddev?: number;
  node_stddev?: number;

  npm_fill?: string;
  yarn_fill?: string;
  pnpm_fill?: string;
  berry_fill?: string;
  deno_fill?: string;
  bun_fill?: string;
  vlt_fill?: string;
  nx_fill?: string;
  turbo_fill?: string;
  node_fill?: string;

  npm_count?: number;
  yarn_count?: number;
  pnpm_count?: number;
  berry_count?: number;
  deno_count?: number;
  bun_count?: number;
  vlt_count?: number;
  nx_count?: number;
  turbo_count?: number;
  node_count?: number;
}

export type FixtureResult = BaseFixtureResult & PackageManagerData;

export interface ChartDataSet {
  variations: Variation[];
  data: Record<Variation, FixtureResult[]>;
  packageManagers: PackageManager[];
  colors: ColorMap;
}

export interface BenchmarkChartData {
  date: string;
  chartData: ChartDataSet;
  perPackageCountChartData: ChartDataSet;
  versions?: PackageManagerVersions;
}

export interface PackageCountEntry {
  count: number;
  minCount?: number;
  maxCount?: number;
}

export interface PackageCountData {
  npm?: PackageCountEntry;
  yarn?: PackageCountEntry;
  pnpm?: PackageCountEntry;
  berry?: PackageCountEntry;
  deno?: PackageCountEntry;
  bun?: PackageCountEntry;
  vlt?: PackageCountEntry;
  nx?: PackageCountEntry;
  turbo?: PackageCountEntry;
  node?: PackageCountEntry;
}

export interface PackageCountTableRow {
  fixture: Fixture;
  variation: Variation;
  packageCounts: PackageCountData;
}

export function isBenchmarkChartData(
  data: unknown,
): data is BenchmarkChartData {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  return !!(
    obj.chartData &&
    typeof obj.chartData === "object" &&
    obj.perPackageCountChartData &&
    typeof obj.perPackageCountChartData === "object"
  );
}

export function isValidVariation(variation: string): variation is Variation {
  const validVariations: Variation[] = [
    "average",
    "cache",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "cache+node_modules",
    "clean",
    "lockfile",
    "lockfile+node_modules",
    "node_modules",
    "run",
  ];
  return validVariations.includes(variation as Variation);
}
