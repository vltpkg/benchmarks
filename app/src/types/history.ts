import type { PackageManagerVersions } from "@/types/chart-data";

export type HistoryVariation = Record<string, (number | null)[]>;

export interface HistoryData {
  dates: string[];
  variations: Record<string, HistoryVariation>;
  /** Package-manager versions keyed by date (YYYY-MM-DD). */
  versionsByDate: Record<string, PackageManagerVersions>;
}

export interface HistoryDataPoint {
  date: string;
  [pm: string]: string | number | null;
}
