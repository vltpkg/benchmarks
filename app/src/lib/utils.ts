import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Variation, Fixture, PackageManager, PackageManagerVersions } from "@/types/chart-data"

interface VariationCategory {
  title: string;
  description: string;
  variations: Variation[];
}

export const getVariationCategories = (variations: Variation[]): VariationCategory[] => {
  const packageManagementVariations: Variation[] = [
    "clean",
    "node_modules",
    "cache",
    "cache+node_modules",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "lockfile",
    "lockfile+node_modules"
  ].filter(v => variations.includes(v as Variation));

  const taskExecutionVariations: Variation[] = [
    "run"
  ].filter(v => variations.includes(v as Variation));

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
