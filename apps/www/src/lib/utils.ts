import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name merge helper.
 *
 * Required by the EvilCharts registry components, which import `cn` from
 * `@/lib/utils`. Taken from legions-developer/evilcharts at
 * ecbd6a5db7b25f9a7e070c02b2ef728c378eeb5c (MIT, Copyright (c) 2026 Gurbinder),
 * minus that file's site-specific exports.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
