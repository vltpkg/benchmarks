import {
  Vlt,
  Astro,
  Aws,
  Berry,
  Bun,
  Deno,
  Next,
  Node,
  Npm,
  Nx,
  Package,
  Pnpm,
  Svelte,
  Turbo,
  Vue,
  Yarn,
  Zpm,
} from "@/components/icons/index";

import type { LucideIcon } from "lucide-react";
import type { Fixture, PackageManager } from "@/types/chart-data";

const packageManagerMap: Partial<Record<PackageManager, LucideIcon>> = {
  aws: Aws,
  bun: Bun,
  deno: Deno,
  node: Node,
  npm: Npm,
  nx: Nx,
  pnpm: Pnpm,
  turbo: Turbo,
  yarn: Yarn,
  berry: Berry,
  zpm: Zpm,
  vlt: Vlt,
};

const frameworkMap: Partial<Record<Fixture, LucideIcon>> = {
  astro: Astro,
  next: Next,
  svelte: Svelte,
  vue: Vue,
  large: Package,
  babylon: Package,
};

export const getPackageManagerIcon = (
  packageManager: PackageManager | undefined,
): LucideIcon | undefined => {
  return packageManager && packageManagerMap[packageManager];
};

export const getFrameworkIcon = (
  framework: Fixture | undefined,
): LucideIcon | undefined => {
  return framework && frameworkMap[framework];
};
