import {
  Vlt,
  Astro,
  Berry,
  Bun,
  Deno,
  Next,
  Npm,
  Package,
  Pnpm,
  Svelte,
  Vue,
  Yarn,
  Zpm,
} from "@/components/icons/index";

import type { LucideIcon } from "lucide-react";
import type { Fixture, PackageManager } from "@/types/chart-data";

const packageManagerMap: Partial<Record<PackageManager, LucideIcon>> = {
  bun: Bun,
  deno: Deno,
  npm: Npm,
  pnpm: Pnpm,
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
  uploadthing: Package,
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
