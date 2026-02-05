const fs = require("fs");
const path = require("path");

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node scripts/clean-benchmarks.js <benchmarks.json>");
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found: ${resolvedPath}`);
  process.exit(1);
}

const calculateMean = (times) =>
  times.reduce((sum, time) => sum + time, 0) / times.length;

const calculateStddev = (times, mean) => {
  const variance =
    times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) /
    times.length;
  return Math.sqrt(variance);
};

const calculateMedian = (times) => {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

let data;
try {
  data = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
} catch (error) {
  console.error(`Error: Could not read ${resolvedPath}: ${error.message}`);
  process.exit(1);
}

if (!data.results || !Array.isArray(data.results)) {
  console.error(`Error: Invalid results format in ${resolvedPath}`);
  process.exit(1);
}

let updated = false;

data.results.forEach((result, index) => {
  const times = Array.isArray(result.times) ? result.times : null;
  const exitCodes = Array.isArray(result.exit_codes) ? result.exit_codes : null;

  if (!times || !exitCodes || times.length !== exitCodes.length) {
    console.warn(
      `Warning: Invalid times/exit_codes arrays (result ${index}) in ${resolvedPath}`,
    );
    return;
  }

  const cleanTimes = times.filter((time, idx) => exitCodes[idx] === 0);
  const cleanExitCodes = exitCodes.filter((code) => code === 0);

  if (cleanTimes.length > 0) {
    const mean = calculateMean(cleanTimes);
    const stddev = calculateStddev(cleanTimes, mean);
    const median = calculateMedian(cleanTimes);
    const min = Math.min(...cleanTimes);
    const max = Math.max(...cleanTimes);

    result.times = cleanTimes;
    result.exit_codes = cleanExitCodes;
    result.mean = mean;
    result.stddev = stddev;
    result.median = median;
    result.min = min;
    result.max = max;

    updated = true;
  } else {
    console.warn(
      `Warning: All runs failed (result ${index}) in ${resolvedPath}`,
    );

    result.times = [0];
    result.exit_codes = [1];
    result.mean = 0;
    result.stddev = 0;
    result.median = 0;
    result.min = 0;
    result.max = 0;
    result.user = 0;
    result.system = 0;

    updated = true;
  }
});

if (updated) {
  fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2));
  console.log(`Cleaned benchmark results: ${resolvedPath}`);
} else {
  console.log(`No changes made: ${resolvedPath}`);
}
