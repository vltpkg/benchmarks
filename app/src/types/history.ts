export type HistoryVariation = Record<string, (number | null)[]>;

export interface HistoryData {
  dates: string[];
  variations: Record<string, HistoryVariation>;
}

export interface HistoryDataPoint {
  date: string;
  [pm: string]: string | number | null;
}
