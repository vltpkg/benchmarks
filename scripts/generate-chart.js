// test it locally like this: `node scripts/generate-chart.js 2025-10-06`
// make sure you have a results/2025-10-06 directory with valid benchmark
// result JSON files (e.g: results/2025-10-06/next-lockfile.json)
// after a succesful run, test the web app rendering the chart data locally
// by copying the result `results/2025-10-06/chart-data.json` file to the
// web app folder in a `latest/` folder, e.g: app/latest/chart-data.json
import fs from "fs";
import path from "path";

const DATE = process.argv[2];
if (!DATE) {
  console.error("Error: Date argument is required");
  process.exit(1);
}

const RESULTS_DIR = path.resolve("results", DATE);
if (!fs.existsSync(RESULTS_DIR)) {
  console.error(`Error: Results directory ${RESULTS_DIR} does not exist`);
  process.exit(1);
}

// Colors for different package managers
const COLORS = {
  npm: "#cb0606",
  yarn: "#117cad",
  pnpm: "#f9ad00",
  berry: "#9555bb",
  zpm: "#7388ff",
  deno: "#70ffaf",
  bun: "#f472b6",
  vlt: "#000000",
  nx: "#3b82f6",
  turbo: "#ff1e56",
  node: "#84ba64",
};

const parseNumeric = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

// Read and process results
function readResults(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data.results || !Array.isArray(data.results)) {
      console.warn(`Warning: Invalid results format in ${file}`);
      return [];
    }
    return data.results.map((r) => {
      const exitCodes = Array.isArray(r.exit_codes) ? r.exit_codes : [];
      return {
        command: r.command,
        mean: parseNumeric(r.mean),
        stddev: parseNumeric(r.stddev),
        exitCodes,
        failed:
          exitCodes.some((code) => typeof code === "number" && code !== 0) ||
          r.success === false ||
          r.status === "failure" ||
          r.result === "failure" ||
          Boolean(r.error),
      };
    });
  } catch (error) {
    console.warn(
      `Warning: Could not read results from ${file}:`,
      error.message,
    );
    return [];
  }
}

// Generate chart data for Recharts
function generateChartData(option = {}) {
  const fixtures = ["next", "astro", "svelte", "vue", "large", "babylon", "run"];
  const variations = [
    "cache",
    "cache+lockfile",
    "cache+lockfile+node_modules",
    "cache+node_modules",
    "clean",
    "lockfile",
    "lockfile+node_modules",
    "node_modules",
    "run",
  ];
  const result = {};

  // Process each variation
  variations.forEach((variation) => {
    const fixtureData = {};
    const seenFixtures = new Set();
    const fixtureEntries = {};
    let globalSlowest = 0;

    // First pass: collect raw data and determine slowest valid results
    fixtures.forEach((fixture) => {
      const file = path.resolve(RESULTS_DIR, `${fixture}-${variation}.json`);
      if (!fs.existsSync(file)) {
        return;
      }

      const results = readResults(file);
      const packageCounts = {};

      // If perPackageCount is enabled, try to load the package count for this fixture/variation
      if (option.perPackageCount) {
        const countFile = path.resolve(
          RESULTS_DIR,
          `${fixture}-${variation}-package-count.json`,
        );
        if (fs.existsSync(countFile)) {
          try {
            const countData = JSON.parse(fs.readFileSync(countFile, "utf8"));
            Object.keys(COLORS).forEach((pm) => {
              if (
                countData &&
                typeof countData === "object" &&
                countData[pm] &&
                typeof countData[pm].count === "number"
              ) {
                packageCounts[pm] = countData[pm].count;
              }
            });
          } catch (e) {
            // Ignore parse errors, fallback to undefined counts
          }
        }
      }

      const pmEntries = {};
      const validValues = [];

      Object.keys(COLORS).forEach((pm) => {
        const pmResult = results.find((r) => r.command === pm);
        if (!pmResult) return;

        const didFail = pmResult.failed || !Number.isFinite(pmResult.mean);
        const count = packageCounts[pm];
        let value =
          typeof pmResult.mean === "number" ? pmResult.mean : undefined;

        if (
          !didFail &&
          option.perPackageCount &&
          typeof count === "number" &&
          count > 0 &&
          typeof value === "number"
        ) {
          value = (value / count) * 1000;
        }

        if (!didFail && typeof value === "number") {
          validValues.push(value);
        }

        pmEntries[pm] = {
          didFail,
          value: didFail ? undefined : value,
          stddev: didFail ? undefined : pmResult.stddev,
          count,
        };
      });

      if (Object.keys(pmEntries).length > 0) {
        const slowestValid =
          validValues.length > 0 ? Math.max(...validValues) : undefined;
        if (typeof slowestValid === "number") {
          globalSlowest = Math.max(globalSlowest, slowestValid);
        }
        fixtureEntries[fixture] = { pmEntries, slowestValid };
      }
    });

    const fallbackGlobal = globalSlowest > 0 ? globalSlowest : undefined;

    Object.entries(fixtureEntries).forEach(([fixture, entry]) => {
      const fixtureResults = {};
      let hasData = false;
      const fallback = entry.slowestValid ?? fallbackGlobal;

      Object.entries(entry.pmEntries).forEach(([pm, pmEntry]) => {
        fixtureResults[`${pm}_fill`] = COLORS[pm];
        if (pmEntry.count !== undefined) {
          fixtureResults[`${pm}_count`] = pmEntry.count;
        }

        if (pmEntry.didFail) {
          fixtureResults[`${pm}_dnf`] = true;
          if (typeof fallback === "number") {
            fixtureResults[pm] = fallback;
            hasData = true;
          }
          return;
        }

        if (typeof pmEntry.value === "number") {
          fixtureResults[pm] = pmEntry.value;
          if (typeof pmEntry.stddev === "number") {
            fixtureResults[`${pm}_stddev`] = pmEntry.stddev;
          }
          hasData = true;
        }
      });

      if (hasData) {
        fixtureResults.fixture = fixture;
        fixtureData[fixture] = fixtureResults;
        seenFixtures.add(fixture);
      }
    });

    if (Object.keys(fixtureData).length > 0) {
      // Convert to array format for Recharts
      result[variation] = Array.from(seenFixtures).map(
        (fixture) => fixtureData[fixture],
      );
    }
  });

  return {
    variations: Object.keys(result),
    data: result,
    packageManagers: Object.keys(COLORS),
    colors: COLORS,
  };
}

// Load package manager version data
function loadPackageManagersVersionData() {
  const versionsFile = path.resolve(RESULTS_DIR, "versions.json");

  try {
    if (!fs.existsSync(versionsFile)) {
      console.warn(`Warning: Versions file ${versionsFile} does not exist`);
      return {};
    }

    const data = JSON.parse(fs.readFileSync(versionsFile, "utf8"));
    return data || {};
  } catch (error) {
    console.warn(
      `Warning: Could not read versions from ${versionsFile}:`,
      error.message,
    );
    return {};
  }
}

const dumpChartData = () => {
  const chartData = generateChartData();
  const perPackageCountChartData = generateChartData({ perPackageCount: true });
  const versions = loadPackageManagersVersionData();

  const results = {
    date: DATE,
    chartData: {
      variations: chartData.variations,
      data: chartData.data,
      packageManagers: chartData.packageManagers,
      colors: chartData.colors,
    },
    perPackageCountChartData: {
      variations: perPackageCountChartData.variations,
      data: perPackageCountChartData.data,
      packageManagers: perPackageCountChartData.packageManagers,
      colors: perPackageCountChartData.colors,
    },
    versions,
  };

  fs.writeFileSync(
    path.join(RESULTS_DIR, "chart-data.json"),
    JSON.stringify(results, null, 2),
  );

  if (Object.keys(chartData.data).length === 0) {
    console.error("Error: No valid benchmark data found to generate chart");
    process.exit(1);
  }
};

try {
  dumpChartData();
  console.log("Chart generation complete!");
} catch (error) {
  console.error("Error generating chart:", error);
  process.exit(1);
}
