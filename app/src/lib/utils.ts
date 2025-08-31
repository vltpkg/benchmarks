import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Variation, Fixture, PackageManager, PackageManagerVersions } from "@/types/chart-data"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortVariations(variations: Variation[]): Variation[] {
  const preferredOrder: Variation[] = [
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules",
    "run",
  ]

  return variations.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a)
    const indexB = preferredOrder.indexOf(b)

    // If both are in preferred order, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }

    // If only one is in preferred order, prioritize it
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1

    // If neither is in preferred order, maintain original order
    return 0
  })
}

export function sortFixtures(fixtures: Fixture[]): Fixture[] {
  const preferredOrder: Fixture[] = [
    "next",
    "vue",
    "svelte",
    "astro",
    "run",
  ]

  return fixtures.sort((a, b) => {
    const indexA = preferredOrder.indexOf(a)
    const indexB = preferredOrder.indexOf(b)

    // If both are in preferred order, sort by index
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }

    // If only one is in preferred order, prioritize it
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1

    // If neither is in preferred order, maintain original order
    return 0
  })
}

export function formatPackageManagerLabel(
  packageManager: PackageManager,
  versions?: PackageManagerVersions
): string {
  if (!versions || !versions[packageManager]) {
    return packageManager;
  }

  const version = versions[packageManager];
  // Remove 'v' prefix if it exists (like node's "v24.0.0"), then add it back consistently
  const cleanVersion = version?.startsWith('v') ? version.slice(1) : version;

  return `${packageManager} v${cleanVersion}`;
}

export function getPackageManagerVersion(
  packageManager: PackageManager,
  versions?: PackageManagerVersions
): string | undefined {
  if (!versions || !versions[packageManager]) {
    return undefined;
  }

  const version = versions[packageManager];
  // Remove 'v' prefix if it exists (like node's "v24.0.0"), then add it back consistently
  const cleanVersion = version?.startsWith('v') ? version.slice(1) : version;

  return `v${cleanVersion}`;
}
