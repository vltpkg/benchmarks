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

// Read and process results
function readResults(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data.results || !Array.isArray(data.results)) {
      console.warn(`Warning: Invalid results format in ${file}`);
      return [];
    }
    return data.results.map((r) => ({
      command: r.command,
      mean: parseFloat(r.mean) || 0,
      stddev: parseFloat(r.stddev) || 0,
    }));
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
  const fixtures = ["next", "astro", "svelte", "vue", "large", "run"];
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

    // First pass: collect all data for each fixture
    fixtures.forEach((fixture) => {
      const fixtureResults = {};
      let hasData = false;

      Object.keys(COLORS).forEach((pm) => {
        const file = path.resolve(RESULTS_DIR, `${fixture}-${variation}.json`);
        let count = undefined;

        // If perPackageCount is enabled, try to load the package count for this fixture/variation
        if (option.perPackageCount) {
          const countFile = path.resolve(
            RESULTS_DIR,
            `${fixture}-${variation}-package-count.json`,
          );
          if (fs.existsSync(countFile)) {
            try {
              const countData = JSON.parse(fs.readFileSync(countFile, "utf8"));
              if (
                countData &&
                typeof countData === "object" &&
                countData[pm] &&
                typeof countData[pm].count === "number"
              ) {
                count = countData[pm].count;
              }
            } catch (e) {
              // Ignore parse errors, fallback to undefined count
            }
          }
        }

        if (fs.existsSync(file)) {
          const results = readResults(file);
          const pmResult = results.find((r) => r.command === pm);
          if (pmResult?.mean) {
            let value = pmResult.mean;
            if (
              option.perPackageCount &&
              typeof count === "number" &&
              count > 0
            ) {
              value = (value / count) * 1000;
            }

            fixtureResults[pm] = value;
            fixtureResults[`${pm}_stddev`] = pmResult.stddev;
            fixtureResults[`${pm}_fill`] = COLORS[pm];

            if (count !== undefined) {
              fixtureResults[`${pm}_count`] = count;
            }

            hasData = true;
          }
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
