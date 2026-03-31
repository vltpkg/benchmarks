export type PackageManager =
  | "npm"
  | "yarn"
  | "pnpm"
  | "pnpm11"
  | "berry"
  | "zpm"
  | "deno"
  | "bun"
  | "vlt"
  | "nx"
  | "turbo"
  | "vp"
  | "node"
  | "aws"
  | "cloudsmith"
  | "github";

export type Fixture =
  | "next"
  | "astro"
  | "svelte"
  | "vue"
  | "large"
  | "babylon"
  | "run";

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
  | "run"
  | "registry-clean"
  | "registry-lockfile";

export type ColorMap = Record<PackageManager, string>;

export interface PackageManagerVersions {
  npm?: string;
  yarn?: string;
  pnpm?: string;
  pnpm11?: string;
  berry?: string;
  zpm?: string;
  deno?: string;
  bun?: string;
  vlt?: string;
  nx?: string;
  turbo?: string;
  vp?: string;
  node?: string;
  aws?: string;
  cloudsmith?: string;
  github?: string;
}

export interface BaseFixtureResult {
  fixture: Fixture;
}

export interface PackageManagerData {
  npm?: number;
  yarn?: number;
  pnpm?: number;
  pnpm11?: number;
  berry?: number;
  zpm?: number;
  deno?: number;
  bun?: number;
  vlt?: number;
  nx?: number;
  turbo?: number;
  vp?: number;
  node?: number;
  aws?: number;
  cloudsmith?: number;
  github?: number;

  npm_stddev?: number;
  yarn_stddev?: number;
  pnpm_stddev?: number;
  pnpm11_stddev?: number;
  berry_stddev?: number;
  zpm_stddev?: number;
  deno_stddev?: number;
  bun_stddev?: number;
  vlt_stddev?: number;
  nx_stddev?: number;
  turbo_stddev?: number;
  vp_stddev?: number;
  node_stddev?: number;
  aws_stddev?: number;
  cloudsmith_stddev?: number;
  github_stddev?: number;

  npm_fill?: string;
  yarn_fill?: string;
  pnpm_fill?: string;
  pnpm11_fill?: string;
  berry_fill?: string;
  zpm_fill?: string;
  deno_fill?: string;
  bun_fill?: string;
  vlt_fill?: string;
  nx_fill?: string;
  turbo_fill?: string;
  vp_fill?: string;
  node_fill?: string;
  aws_fill?: string;
  cloudsmith_fill?: string;
  github_fill?: string;

  npm_count?: number;
  yarn_count?: number;
  pnpm_count?: number;
  pnpm11_count?: number;
  berry_count?: number;
  zpm_count?: number;
  deno_count?: number;
  bun_count?: number;
  vlt_count?: number;
  nx_count?: number;
  turbo_count?: number;
  vp_count?: number;
  node_count?: number;
  aws_count?: number;
  cloudsmith_count?: number;
  github_count?: number;

  npm_dnf?: boolean;
  yarn_dnf?: boolean;
  pnpm_dnf?: boolean;
  pnpm11_dnf?: boolean;
  berry_dnf?: boolean;
  zpm_dnf?: boolean;
  deno_dnf?: boolean;
  bun_dnf?: boolean;
  vlt_dnf?: boolean;
  nx_dnf?: boolean;
  turbo_dnf?: boolean;
  vp_dnf?: boolean;
  node_dnf?: boolean;
  aws_dnf?: boolean;
  cloudsmith_dnf?: boolean;
  github_dnf?: boolean;
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
  commitSha?: string;
  chartData: ChartDataSet;
  perPackageCountChartData: ChartDataSet;
  registryChartData?: ChartDataSet;
  registryPerPackageCountChartData?: ChartDataSet;
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
  pnpm11?: PackageCountEntry;
  berry?: PackageCountEntry;
  zpm?: PackageCountEntry;
  deno?: PackageCountEntry;
  bun?: PackageCountEntry;
  vlt?: PackageCountEntry;
  nx?: PackageCountEntry;
  turbo?: PackageCountEntry;
  vp?: PackageCountEntry;
  node?: PackageCountEntry;
  aws?: PackageCountEntry;
  cloudsmith?: PackageCountEntry;
  github?: PackageCountEntry;
}

export interface PackageCountTableRow {
  fixture: Fixture;
  variation: Variation;
  packageCounts: PackageCountData;
}

export interface ProcessCountData {
  npm?: PackageCountEntry;
  yarn?: PackageCountEntry;
  pnpm?: PackageCountEntry;
  pnpm11?: PackageCountEntry;
  berry?: PackageCountEntry;
  zpm?: PackageCountEntry;
  deno?: PackageCountEntry;
  bun?: PackageCountEntry;
  vlt?: PackageCountEntry;
  nx?: PackageCountEntry;
  turbo?: PackageCountEntry;
  vp?: PackageCountEntry;
  node?: PackageCountEntry;
  aws?: PackageCountEntry;
  cloudsmith?: PackageCountEntry;
  github?: PackageCountEntry;
}

export interface ProcessCountTableRow {
  fixture: Fixture;
  variation: Variation;
  processCounts: ProcessCountData;
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
    "registry-clean",
    "registry-lockfile",
  ];
  return validVariations.includes(variation as Variation);
}
