// Canonical timing: median of successful measured runs, including measured run 0.
// Hyperfine does not include its explicit warmup runs in `times`.
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const finite = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const benchmarkStatistics = (result) => {
  // Older result files can serialize summary fields as numeric strings.
  const numeric = (value) => {
    const parsed =
      typeof value === "string" && value.trim() ? Number(value) : value;
    return finite(parsed) ? parsed : undefined;
  };
  const storedMedian = numeric(result.median);
  const storedMean = numeric(result.mean);
  const codes = Array.isArray(result.exit_codes) ? result.exit_codes : [];
  const times = Array.isArray(result.times) ? result.times : undefined;
  const samples = times?.filter(
    (time, i) => finite(time) && (!codes.length || codes[i] === 0),
  );
  const successfulRuns = samples?.length ?? result.successful_runs;
  const attemptedRuns = result.attempted_runs ?? times?.length;
  const droppedRuns =
    result.dropped_runs ??
    (attemptedRuns !== undefined && successfulRuns !== undefined
      ? attemptedRuns - successfulRuns
      : codes.filter((code) => code !== 0).length);
  const failed =
    result.status === "failure" ||
    result.success === false ||
    result.result === "failure" ||
    Boolean(result.error) ||
    (samples !== undefined && samples.length === 0) ||
    (!samples && codes.some((code) => code !== 0));
  const partial = !failed && (result.status === "partial" || droppedRuns > 0);
  const value = failed
    ? undefined
    : samples?.length
      ? median(samples)
      : (storedMedian ?? storedMean);
  return {
    value,
    statistic:
      samples?.length || storedMedian !== undefined ? "median" : "legacy-mean",
    sampleCount: successfulRuns,
    attemptedRuns,
    droppedRuns,
    partial,
    failed: failed || !finite(value),
    min: samples?.length ? Math.min(...samples) : numeric(result.min),
    max: samples?.length ? Math.max(...samples) : numeric(result.max),
    stddev: numeric(result.stddev),
  };
};

const formatBenchmarkSummary = (result) => {
  const stats = benchmarkStatistics(result);
  if (stats.failed) return `${result.command}: DNF`;
  const sample =
    stats.sampleCount === undefined
      ? "sample count unknown"
      : `${stats.sampleCount}/${stats.attemptedRuns ?? stats.sampleCount} successful runs`;
  const range =
    finite(stats.min) && finite(stats.max)
      ? `; range ${stats.min}s–${stats.max}s`
      : "";
  return `${result.command}: ${stats.value}s (${stats.statistic}; ${sample}${range}${stats.partial ? "; PARTIAL" : ""})`;
};

module.exports = { median, benchmarkStatistics, formatBenchmarkSummary };

if (require.main === module) {
  const fs = require("node:fs");
  const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  for (const result of data.results)
    console.log(formatBenchmarkSummary(result));
}
