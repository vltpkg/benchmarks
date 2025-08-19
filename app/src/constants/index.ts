
export const TODAY = new Date();

export const DATE_YEAR = TODAY.getFullYear();

export const DATE_MONTH = String(TODAY.getMonth() + 1).padStart(2, "0");

export const DATE_DAY = String(TODAY.getDate()).padStart(2, "0");

export const CHART_DATA_URL = `/benchmarks/${DATE_YEAR}-${DATE_MONTH}-${DATE_DAY}/chart-data.json`;

export const CHART_DEFAULTS = {
  HEIGHT: 300,
  MAX_BAR_SIZE: 60,
  TICK_COUNT: 10,
} as const;

export const LOADING_MESSAGES = {
  CHART_DATA: "Loading benchmark data...",
  PROCESSING: "Processing data...",
} as const;

export const ERROR_MESSAGES = {
  FETCH_FAILED: "Failed to load benchmark data",
  INVALID_DATA: "Invalid chart data format received from server",
  INVALID_VARIATION: "The requested variation is not valid",
  NETWORK_ERROR: "Network error occurred while fetching data",
} as const;
