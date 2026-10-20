import {
  Vlt,
  Astro,
  Aube,
  Aws,
  Berry,
  Bun,
  Cloudsmith,
  Deno,
  Github,
  Jfrog,
  Next,
  Node,
  Npm,
  Nx,
  Package,
  Pnpm,
  Svelte,
  Turbo,
  Upm,
  Vp,
  Vue,
  Yarn,
  Zpm,
} from "@/components/icons/index";

import type { LucideIcon } from "lucide-react";
import type { Fixture, PackageManager } from "@/types/chart-data";

const packageManagerMap: Partial<Record<PackageManager, LucideIcon>> = {
  aube: Aube,
  aws: Aws,
  bun: Bun,
  cloudsmith: Cloudsmith,
  github: Github,
  jfrog: Jfrog,
  deno: Deno,
  node: Node,
  npm: Npm,
  nx: Nx,
  pnpm: Pnpm,
  turbo: Turbo,
  upm: Upm,
  vp: Vp,
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
