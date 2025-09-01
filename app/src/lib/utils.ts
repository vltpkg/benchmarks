import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Variation, Fixture, PackageManager, PackageManagerVersions, BenchmarkChartData, FixtureResult, PackageCountData } from "@/types/chart-data"

interface VariationCategory {
  title: string;
  description: string;
  variations: Variation[];
}

export const isTaskExecutionVariation = (variation: string): boolean => {
  const taskExecutionVariations = ["run"];
  return taskExecutionVariations.includes(variation);
};

export const getVariationCategories = (variations: Variation[]): VariationCategory[] => {
  const packageManagementVariations = [
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules"
  ].filter(v => variations.includes(v as Variation)) as Variation[];

  const taskExecutionVariations = [
    "run"
  ].filter(v => variations.includes(v as Variation)) as Variation[];

  const categories: VariationCategory[] = [];

  if (packageManagementVariations.length > 0) {
    categories.push({
      title: "Package Management",
      description: "Installation scenarios with different cache and lockfile states",
      variations: sortVariations(packageManagementVariations)
    });
  }

  if (taskExecutionVariations.length > 0) {
    categories.push({
      title: "Task Execution",
      description: "Script and command execution performance",
      variations: sortVariations(taskExecutionVariations)
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

export const calculateLeaderboard = (chartData: BenchmarkChartData): RankingData[] => {
  // Define package managers only (exclude tools like node, nx, turbo)
  const packageManagers = ['npm', 'pnpm', 'yarn', 'berry', 'bun', 'deno', 'vlt'];
  const availablePackageManagers = chartData.chartData.packageManagers.filter((pm: string) =>
    packageManagers.includes(pm)
  ) as PackageManager[];

  const packageManagerStats: Partial<Record<PackageManager, { wins: number; totalTime: number; testCount: number }>> = {};

  // Initialize stats for package managers only
  availablePackageManagers.forEach(pm => {
    packageManagerStats[pm] = { wins: 0, totalTime: 0, testCount: 0 };
  });

  // Get package management variations (excluding "run")
  const packageManagementVariations = getVariationCategories(chartData.chartData.variations)
    .find(cat => cat.title === "Package Management")?.variations || [];

    // Calculate actual performance for each fixture and variation using per-package data
  packageManagementVariations.forEach(variation => {
    const variationData = chartData.perPackageCountChartData.data[variation];
    if (!variationData) return;

    variationData.forEach((fixtureResult: FixtureResult) => {
      // Get all package manager times for this fixture (per-package timing)
      const times: Array<{ pm: PackageManager; time: number }> = [];

      availablePackageManagers.forEach(pm => {
        const time = fixtureResult[pm];
        if (typeof time === 'number' && time > 0) {
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
  const leaderboard: RankingData[] = availablePackageManagers.map(pm => {
    const stats = packageManagerStats[pm];
    if (!stats) {
      return {
        packageManager: pm,
        wins: 0,
        averageTime: Number.MAX_SAFE_INTEGER,
        totalTests: 0
      };
    }
    const averageTime = stats.testCount > 0 ? stats.totalTime / stats.testCount : Number.MAX_SAFE_INTEGER;

    return {
      packageManager: pm,
      wins: stats.wins,
      averageTime,
      totalTests: stats.testCount
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

export function getFixtureLogo(fixture: Fixture): string | undefined {
  const logoMap: Record<Fixture, string | undefined> = {
    next: "data:image/svg+xml;base64," + btoa('<?xml version="1.0" encoding="UTF-8"?><svg data-testid="geist-icon" height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_53_108)"><circle cx="8" cy="8" r="7.375" fill="black" stroke="var(--ds-gray-1000)" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.63 11V5" stroke="url(#paint0_linear_53_108_r_2il_)" stroke-width="1.25" stroke-miterlimit="1.41421"/><path fill-rule="evenodd" clip-rule="evenodd" d="M5.995 5.00087V5H4.745V11H5.995V6.96798L12.3615 14.7076C12.712 14.4793 13.0434 14.2242 13.353 13.9453L5.99527 5.00065L5.995 5.00087Z" fill="url(#paint1_linear_53_108_r_2il_)"/></g><defs><linearGradient id="paint0_linear_53_108_r_2il_" x1="11.13" y1="5" x2="11.13" y2="11" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="0.609375" stop-color="white" stop-opacity="0.57"/><stop offset="0.796875" stop-color="white" stop-opacity="0"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><linearGradient id="paint1_linear_53_108_r_2il_" x1="9.9375" y1="9.0625" x2="13.5574" y2="13.3992" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><clipPath id="clip0_53_108"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>'),
    vue: "data:image/svg+xml;base64," + btoa('<?xml version="1.0" encoding="UTF-8"?><svg data-testid="geist-icon" height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_872_3155)"><path d="M9.71934 0.916722L7.87183 4.11672L6.02431 0.916722H-0.128174L7.87183 14.7733L15.8718 0.916722H9.71934Z" fill="#41B883"/><path d="M9.71929 0.916724L7.87178 4.11672L6.02426 0.916724H3.07178L7.87178 9.2305L12.6718 0.916724H9.71929Z" fill="#34495E"/></g><defs><clipPath id="clip0_872_3155"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>'),
    svelte: "data:image/svg+xml;base64," + btoa('<?xml version="1.0" encoding="UTF-8"?><svg data-testid="geist-icon" height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M13.7974 2.11525C12.3195 -0.0135593 9.37709 -0.637288 7.26183 0.705085L3.53302 3.09153C2.51607 3.72881 1.81098 4.77288 1.60759 5.95254C1.43132 6.94237 1.58048 7.95932 2.05505 8.84068C1.72963 9.32881 1.51268 9.87119 1.41776 10.4407C1.20082 11.6475 1.48556 12.8949 2.19065 13.8847C3.68217 16.0136 6.61098 16.6373 8.72624 15.2949L12.4551 12.922C13.472 12.2847 14.1771 11.2407 14.3805 10.061C14.5567 9.07119 14.4076 8.05424 13.933 7.17288C14.2584 6.68475 14.4754 6.14237 14.5703 5.57288C14.8008 4.35254 14.5161 3.10508 13.7974 2.11525Z" fill="#FF3E00"/><path d="M6.8958 14.0881C5.68902 14.4 4.428 13.9254 3.72292 12.9085C3.28902 12.3119 3.12631 11.5661 3.24834 10.8339C3.27546 10.7119 3.30258 10.6034 3.3297 10.4814L3.3975 10.2644L3.58733 10.4C4.03478 10.7254 4.52292 10.9695 5.05173 11.1322L5.18733 11.1729L5.17377 11.3085C5.16021 11.4983 5.21445 11.7017 5.32292 11.8644C5.53987 12.1763 5.91953 12.3254 6.28563 12.2305C6.36699 12.2034 6.44834 12.1763 6.51614 12.1356L10.2314 9.76271C10.4212 9.64068 10.5433 9.46441 10.5839 9.24746C10.6246 9.03051 10.5704 8.8 10.4483 8.62373C10.2314 8.31186 9.85173 8.17627 9.48563 8.27119C9.40428 8.29831 9.32292 8.32542 9.25512 8.3661L7.83139 9.27458C7.60089 9.42373 7.34326 9.5322 7.07207 9.6C5.86529 9.91187 4.60428 9.43729 3.89919 8.42034C3.47885 7.82373 3.30258 7.07797 3.43817 6.34576C3.56021 5.64068 3.99411 5.00339 4.60428 4.62373L8.33309 2.25085C8.5636 2.1017 8.82123 1.99322 9.09241 1.91186C10.2992 1.6 11.5602 2.07458 12.2653 3.09153C12.6992 3.68814 12.8619 4.4339 12.7399 5.1661C12.7128 5.28814 12.6856 5.39661 12.645 5.51864L12.5772 5.73559L12.3873 5.6C11.9399 5.27458 11.4517 5.03051 10.9229 4.8678L10.7873 4.82712L10.8009 4.69153C10.8144 4.50169 10.7602 4.29831 10.6517 4.13559C10.4348 3.82373 10.0551 3.68814 9.68902 3.78305C9.60767 3.81017 9.52631 3.83729 9.45851 3.87797L5.74326 6.25085C5.55343 6.37288 5.43139 6.54915 5.39072 6.7661C5.35004 6.98305 5.40428 7.21356 5.52631 7.38983C5.74326 7.7017 6.12292 7.83729 6.48902 7.74237C6.57038 7.71525 6.65173 7.68814 6.71953 7.64746L8.14326 6.73898C8.37377 6.58983 8.63139 6.48136 8.90258 6.4C10.1094 6.08814 11.3704 6.56271 12.0755 7.57966C12.5094 8.17627 12.6721 8.92203 12.55 9.65424C12.428 10.3593 11.9941 10.9966 11.3839 11.3763L7.65512 13.7492C7.42461 13.8983 7.16699 14.0068 6.8958 14.0881Z" fill="white"/><defs><rect width="16" height="16" fill="white"/></defs></svg>'),
    astro: "data:image/svg+xml;base64," + btoa('<?xml version="1.0" encoding="UTF-8"?><svg data-testid="geist-icon" height="16" stroke-linejoin="round" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M5.53468 13.4411C4.73241 12.7283 4.49823 11.2306 4.83247 10.1456C5.41202 10.8297 6.21502 11.0464 7.04678 11.1687C8.33085 11.3575 9.5919 11.2869 10.7847 10.7164C10.9212 10.6511 11.0473 10.5642 11.1964 10.4763C11.3083 10.7919 11.3374 11.1105 11.2984 11.4348C11.2033 12.2247 10.7989 12.8348 10.1557 13.2972C9.89855 13.4822 9.6264 13.6476 9.36077 13.822C8.54473 14.3581 8.32393 14.9867 8.63058 15.9011C8.63787 15.9234 8.64439 15.9457 8.66087 16C8.24422 15.8188 7.93987 15.5549 7.70798 15.2079C7.46305 14.8417 7.34652 14.4366 7.34039 13.9983C7.33733 13.785 7.33733 13.5698 7.30781 13.3595C7.23576 12.8468 6.98814 12.6173 6.52167 12.6041C6.04293 12.5905 5.66423 12.8782 5.5638 13.3312C5.55614 13.3659 5.54503 13.4003 5.53391 13.4407L5.53468 13.4411Z" fill="url(#paint0_linear_1427_1479)"/><path d="M1.5 10.4778C1.5 10.4778 3.69363 9.42783 5.89339 9.42783L7.55193 4.38471C7.61401 4.14081 7.79533 3.97508 8 3.97508C8.20469 3.97508 8.38599 4.14081 8.44809 4.38471L10.1066 9.42783C12.7119 9.42783 14.5 10.4778 14.5 10.4778C14.5 10.4778 10.7739 0.504764 10.7667 0.484756C10.6597 0.1899 10.4792 0 10.2358 0H5.7646C5.5212 0 5.34796 0.1899 5.23372 0.484756C5.22567 0.504387 1.5 10.4778 1.5 10.4778Z" fill="currentColor"/><defs><linearGradient id="paint0_linear_1427_1479" x1="4.68506" y1="16" x2="12.3496" y2="12.2743" gradientUnits="userSpaceOnUse"><stop stop-color="#D83333"/><stop offset="1" stop-color="#F041FF"/></linearGradient></defs></svg>'),
    run: undefined, // No logo for "run" fixture
  };

  return logoMap[fixture];
}

// Deep linking utilities
export function createSectionId(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function createDeepLink(
  variation: string,
  section?: string,
  fixture?: string,
  filters?: {
    packageManagers?: string[];
    fixtures?: string[];
  }
): string {
  let path = `/${variation}`;
  if (section) {
    path += `/${section}`;
  }
  if (fixture) {
    path += `/${fixture}`;
  }

  // Add query parameters for filters
  if (filters && (filters.packageManagers || filters.fixtures)) {
    const params = new URLSearchParams();

    if (filters.packageManagers && filters.packageManagers.length > 0) {
      params.set('tools', filters.packageManagers.join(','));
    }

    if (filters.fixtures && filters.fixtures.length > 0) {
      params.set('fixtures', filters.fixtures.join(','));
    }

    path += `?${params.toString()}`;
  }

  return path;
}

export function parseFiltersFromURL(): {
  packageManagers?: string[];
} {
  const urlParams = new URLSearchParams(window.location.search);
  const result: { packageManagers?: string[] } = {};

  const tools = urlParams.get('tools');
  if (tools) {
    result.packageManagers = tools.split(',').filter(Boolean);
  }

  return result;
}

export function updateURLWithFilters(enabledPackageManagers: Set<string>): void {
  const url = new URL(window.location.href);

  // Update package managers filter
  if (enabledPackageManagers.size > 0) {
    url.searchParams.set('tools', Array.from(enabledPackageManagers).join(','));
  } else {
    url.searchParams.delete('tools');
  }

  // Update URL without reloading
  window.history.replaceState({}, '', url.toString());
}

export function scrollToSection(sectionId: string, offset: number = 80): void {
  const element = document.getElementById(sectionId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

export function getFixtureId(fixture: string): string {
  return fixture.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export function getPackageManagerLogo(packageManager: PackageManager, theme?: 'light' | 'dark'): string | undefined {
  const logoMap: Partial<Record<PackageManager, string>> = {
    npm: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><path fill="#c12127" d="M0 256V0h256v256z"/><path fill="#fff" d="M48 48h160v160h-32V80h-48v128H48z"/></svg>'),
    pnpm: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path fill="#f8ab00" d="M0 .004V40h39.996V.004Zm43.996 0V40h40V.004Zm44.008 0V40H128V.004Zm0 43.996v39.996H128V44Z"/><path fill="#4c4c4c" d="M43.996 44v39.996h40V44ZM0 87.996v40h39.996v-40Zm43.996 0v40h40v-40Zm44.008 0v40H128v-40Z"/></svg>'),
    yarn: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path fill="#2c8ebb" d="M64 0a64 64 0 1 0 64 64A64 64 0 0 0 64 0m4.685 21.948a5.04 5.04 0 0 1 2.21.802c.671.444 1.528 1.032 4.026 6.194a4.84 4.84 0 0 1 2.942-.103a3.93 3.93 0 0 1 2.468 2.004c2.55 4.893 2.889 13.614 1.774 19.22a34.9 34.9 0 0 1-6.028 13.74a26.6 26.6 0 0 1 5.957 9.733a26.2 26.2 0 0 1 1.456 10.746a30 30 0 0 0 3.22-1.796c3.158-1.951 7.927-4.894 13.615-4.966a6.834 6.834 0 0 1 7.225 5.885a6.555 6.555 0 0 1-5.046 7.256c-3.458.836-5.069 1.486-9.714 4.5a69.2 69.2 0 0 1-16.062 7.412a9 9 0 0 1-3.758 1.828c-3.933.96-17.425 1.682-18.488 1.682h-.248c-4.13 0-6.47-1.28-7.73-2.621c-3.51 1.755-8.052 1.03-11.355-.714a5.73 5.73 0 0 1-3.097-4.024a6.2 6.2 0 0 1 0-2.127a7 7 0 0 1-.816-1.032a16.9 16.9 0 0 1-2.333-10.386c.3-3.85 2.964-7.287 4.698-9.114A29.5 29.5 0 0 1 35.726 64a27.7 27.7 0 0 1 7.04-9.29c-1.703-2.87-3.436-7.288-1.754-11.789c1.208-3.21 2.199-4.996 4.377-5.76a7.1 7.1 0 0 0 2.59-1.383a18.22 18.22 0 0 1 12.243-5.843c.196-.495.423-1.033.671-1.508c1.652-3.51 3.406-5.48 5.46-6.193a5.04 5.04 0 0 1 2.332-.286m-.558 3.697c-2.703.089-5.355 8.099-5.355 8.099a14.45 14.45 0 0 0-12.089 4.645a9.95 9.95 0 0 1-3.973 2.345c-.424.144-.94.122-2.22 3.58c-1.961 5.234 3.345 11.16 3.345 11.16s-6.328 4.47-8.672 10.034a25.6 25.6 0 0 0-1.806 12.057s-4.5 3.901-4.788 7.927a13.3 13.3 0 0 0 1.826 8.083a2.003 2.003 0 0 0 2.714.94s-2.993 3.487-.196 4.963c2.55 1.331 6.844 2.065 9.115-.196c1.652-1.651 1.982-5.335 2.591-6.842c.144-.351.64.588 1.115 1.032a10.3 10.3 0 0 0 1.403 1.032s-4.024 1.734-2.373 5.688c.547 1.31 2.498 2.145 5.688 2.125c1.187 0 14.203-.743 17.671-1.58a4.47 4.47 0 0 0 2.696-1.505a65 65 0 0 0 15.99-7.226c4.892-3.19 6.895-4.059 10.848-4.998c3.262-.774 3.045-5.83-1.28-5.758c-4.48.052-8.402 2.363-11.716 4.427c-6.193 3.83-9.29 3.583-9.29 3.583l-.105-.175c-.423-.692 1.983-6.896-.712-14.287c-2.91-8.082-7.534-10.033-7.163-10.653c1.58-2.673 5.534-6.917 7.113-14.824c.94-4.79.691-12.676-1.435-16.805c-.393-.764-3.902 1.28-3.902 1.28s-3.283-7.319-4.201-7.907a1.44 1.44 0 0 0-.839-.244"/></svg>'),
    berry: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path fill="#9555bb" d="M64 0a64 64 0 1 0 64 64A64 64 0 0 0 64 0m4.685 21.948a5.04 5.04 0 0 1 2.21.802c.671.444 1.528 1.032 4.026 6.194a4.84 4.84 0 0 1 2.942-.103a3.93 3.93 0 0 1 2.468 2.004c2.55 4.893 2.889 13.614 1.774 19.22a34.9 34.9 0 0 1-6.028 13.74a26.6 26.6 0 0 1 5.957 9.733a26.2 26.2 0 0 1 1.456 10.746a30 30 0 0 0 3.22-1.796c3.158-1.951 7.927-4.894 13.615-4.966a6.834 6.834 0 0 1 7.225 5.885a6.555 6.555 0 0 1-5.046 7.256c-3.458.836-5.069 1.486-9.714 4.5a69.2 69.2 0 0 1-16.062 7.412a9 9 0 0 1-3.758 1.828c-3.933.96-17.425 1.682-18.488 1.682h-.248c-4.13 0-6.47-1.28-7.73-2.621c-3.51 1.755-8.052 1.03-11.355-.714a5.73 5.73 0 0 1-3.097-4.024a6.2 6.2 0 0 1 0-2.127a7 7 0 0 1-.816-1.032a16.9 16.9 0 0 1-2.333-10.386c.3-3.85 2.964-7.287 4.698-9.114A29.5 29.5 0 0 1 35.726 64a27.7 27.7 0 0 1 7.04-9.29c-1.703-2.87-3.436-7.288-1.754-11.789c1.208-3.21 2.199-4.996 4.377-5.76a7.1 7.1 0 0 0 2.59-1.383a18.22 18.22 0 0 1 12.243-5.843c.196-.495.423-1.033.671-1.508c1.652-3.51 3.406-5.48 5.46-6.193a5.04 5.04 0 0 1 2.332-.286m-.558 3.697c-2.703.089-5.355 8.099-5.355 8.099a14.45 14.45 0 0 0-12.089 4.645a9.95 9.95 0 0 1-3.973 2.345c-.424.144-.94.122-2.22 3.58c-1.961 5.234 3.345 11.16 3.345 11.16s-6.328 4.47-8.672 10.034a25.6 25.6 0 0 0-1.806 12.057s-4.5 3.901-4.788 7.927a13.3 13.3 0 0 0 1.826 8.083a2.003 2.003 0 0 0 2.714.94s-2.993 3.487-.196 4.963c2.55 1.331 6.844 2.065 9.115-.196c1.652-1.651 1.982-5.335 2.591-6.842c.144-.351.64.588 1.115 1.032a10.3 10.3 0 0 0 1.403 1.032s-4.024 1.734-2.373 5.688c.547 1.31 2.498 2.145 5.688 2.125c1.187 0 14.203-.743 17.671-1.58a4.47 4.47 0 0 0 2.696-1.505a65 65 0 0 0 15.99-7.226c4.892-3.19 6.895-4.059 10.848-4.998c3.262-.774 3.045-5.83-1.28-5.758c-4.48.052-8.402 2.363-11.716 4.427c-6.193 3.83-9.29 3.583-9.29 3.583l-.105-.175c-.423-.692 1.983-6.896-.712-14.287c-2.91-8.082-7.534-10.033-7.163-10.653c1.58-2.673 5.534-6.917 7.113-14.824c.94-4.79.691-12.676-1.435-16.805c-.393-.764-3.902 1.28-3.902 1.28s-3.283-7.319-4.201-7.907a1.44 1.44 0 0 0-.839-.244"/></svg>'),
    bun: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#fbf0df" d="M29 17c0 5.65-5.82 10.23-13 10.23S3 22.61 3 17c0-3.5 2.24-6.6 5.66-8.44S14.21 4.81 16 4.81s3.32 1.54 7.34 3.71C26.76 10.36 29 13.46 29 17"/><path fill="none" stroke="#000" d="M16 27.65c7.32 0 13.46-4.65 13.46-10.65c0-3.72-2.37-7-5.89-8.85c-1.39-.75-2.46-1.41-3.37-2l-1.13-.69A6.14 6.14 0 0 0 16 4.35a6.9 6.9 0 0 0-3.3 1.23c-.42.24-.86.51-1.32.8c-.87.54-1.83 1.13-3 1.73C4.91 10 2.54 13.24 2.54 17c0 6 6.14 10.65 13.46 10.65Z" stroke-width="1"/><ellipse cx="21.65" cy="18.62" fill="#febbd0" rx="2.17" ry="1.28"/><ellipse cx="10.41" cy="18.62" fill="#febbd0" rx="2.17" ry="1.28"/><path fill-rule="evenodd" d="M11.43 18.11a2 2 0 1 0-2-2.05a2.05 2.05 0 0 0 2 2.05m9.2 0a2 2 0 1 0-2-2.05a2 2 0 0 0 2 2.05"/><path fill="#fff" fill-rule="evenodd" d="M10.79 16.19a.77.77 0 1 0-.76-.77a.76.76 0 0 0 .76.77m9.2 0a.77.77 0 1 0 0-1.53a.77.77 0 0 0 0 1.53"/><path fill="#b71422" stroke="#000" stroke-width="0.75" d="M18.62 19.67a3.3 3.3 0 0 1-1.09 1.75a2.48 2.48 0 0 1-1.5.69a2.53 2.53 0 0 1-1.5-.69a3.28 3.28 0 0 1-1.08-1.75a.26.26 0 0 1 .29-.3h4.58a.27.27 0 0 1 .3.3Z"/><path fill="#ccbea7" fill-rule="evenodd" d="M14.93 5.75a6.1 6.1 0 0 1-2.09 4.62c-.1.09 0 .27.11.22c1.25-.49 2.94-1.94 2.23-4.88c-.03-.15-.25-.11-.25.04m.85 0a6 6 0 0 1 .57 5c0 .13.12.24.21.13c.83-1 1.54-3.11-.59-5.31c-.1-.11-.27.04-.19.17Zm1-.06a6.1 6.1 0 0 1 2.53 4.38c0 .14.21.17.24 0c.34-1.3.15-3.51-2.66-4.66c-.12-.02-.21.18-.09.27ZM9.94 9.55a6.27 6.27 0 0 0 3.89-3.33c.07-.13.28-.08.25.07c-.64 3-2.79 3.59-4.13 3.51c-.14-.01-.14-.21-.01-.25"/></svg>'),
    vlt: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-vlt lucide-Vlt h-6 w-6 text-muted-foreground" aria-hidden="true"><path d="M8.66659 6.33329C8.66659 6.68925 8.61079 7.03216 8.50747 7.35379C8.21694 8.2582 7.99884 9.28798 8.47332 10.1109L10.6593 13.9022C10.9243 14.3618 11.4692 14.5626 11.9997 14.5626C12.5304 14.5626 13.0755 14.3617 13.3406 13.902L15.5265 10.1108C16.001 9.28787 15.7829 8.25813 15.4924 7.35374C15.389 7.03215 15.3333 6.68925 15.3333 6.33332C15.3333 4.49239 16.8257 3.00003 18.6666 3.00003C20.5075 3.00003 21.9999 4.49239 21.9999 6.33332C21.9999 8.17424 20.5075 9.66661 18.6666 9.66661C18.1358 9.66661 17.5906 9.86748 17.3254 10.3273L15.1397 14.1182C14.6652 14.9411 14.8834 15.971 15.1739 16.8754C15.2772 17.197 15.333 17.54 15.333 17.8959C15.333 19.7368 13.8406 21.2292 11.9997 21.2292C10.1588 21.2292 8.66644 19.7368 8.66644 17.8959C8.66644 17.5399 8.72226 17.1969 8.8256 16.8752C9.1162 15.9708 9.33437 14.9409 8.85984 14.1179L6.67422 10.3272C6.40911 9.86744 5.86403 9.66659 5.33329 9.66659C3.49237 9.66659 2 8.17422 2 6.33329C2 4.49237 3.49237 3 5.33329 3C7.17422 3 8.66659 4.49237 8.66659 6.33329Z" fill="currentColor" stroke-width="0"></path></svg>')
  };

  // Special handling for Deno - use different colors based on theme
  if (packageManager === 'deno') {
    const denoColor = theme === 'dark' ? '#70ffaf' : '#000000';
    return "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${denoColor}" d="M1.105 18.02A11.9 11.9 0 0 1 0 12.985q0-.698.078-1.376a12 12 0 0 1 .231-1.34A12 12 0 0 1 4.025 4.02a12 12 0 0 1 5.46-2.771a12 12 0 0 1 3.428-.23c1.452.112 2.825.477 4.077 1.05a12 12 0 0 1 2.78 1.774a12.02 12.02 0 0 1 4.053 7.078A12 12 0 0 1 24 12.985q0 .454-.036.914a12 12 0 0 1-.728 3.305a12 12 0 0 1-2.38 3.875c-1.33 1.357-3.02 1.962-4.43 1.936a4.4 4.4 0 0 1-2.724-1.024c-.99-.853-1.391-1.83-1.53-2.919a5 5 0 0 1 .128-1.518c.105-.38.37-1.116.76-1.437c-.455-.197-1.04-.624-1.226-.829c-.045-.05-.04-.13 0-.183a.155.155 0 0 1 .177-.053c.392.134.869.267 1.372.35c.66.111 1.484.25 2.317.292c2.03.1 4.153-.813 4.812-2.627s.403-3.609-1.96-4.685s-3.454-2.356-5.363-3.128c-1.247-.505-2.636-.205-4.06.582c-3.838 2.121-7.277 8.822-5.69 15.032a.191.191 0 0 1-.315.19a12 12 0 0 1-1.25-1.634a12 12 0 0 1-.769-1.404M11.57 6.087c.649-.051 1.214.501 1.31 1.236c.13.979-.228 1.99-1.41 2.013c-1.01.02-1.315-.997-1.248-1.614c.066-.616.574-1.575 1.35-1.635"/></svg>`);
  }

  return logoMap[packageManager];
}

export const getAvailablePackageManagers = (
  variationData: FixtureResult[],
  allPackageManagers: PackageManager[]
): PackageManager[] => {
  const availablePackageManagers = new Set<PackageManager>();

  variationData.forEach(fixtureResult => {
    allPackageManagers.forEach(pm => {
      const value = fixtureResult[pm];
      // Check if the package manager has valid data (not undefined, null, or 0)
      if (value !== undefined && value !== null && typeof value === 'number' && value > 0) {
        availablePackageManagers.add(pm);
      }
    });
  });

  return allPackageManagers.filter(pm => availablePackageManagers.has(pm));
};

export const getAvailablePackageManagersFromPackageCount = (
  packageCountData: Array<{ packageCounts?: PackageCountData }>,
  allPackageManagers: PackageManager[]
): PackageManager[] => {
  const availablePackageManagers = new Set<PackageManager>();

  packageCountData.forEach(item => {
    if (item.packageCounts) {
      allPackageManagers.forEach(pm => {
        const entry = item.packageCounts?.[pm as keyof PackageCountData];
        // Check if the package manager has valid data (entry exists and has count > 0)
        if (entry && typeof entry === 'object' && entry.count && entry.count > 0) {
          availablePackageManagers.add(pm);
        }
      });
    }
  });

  return allPackageManagers.filter(pm => availablePackageManagers.has(pm));
};
