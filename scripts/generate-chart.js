const fs = require('fs');
const path = require('path');

const DATE = process.argv[2];
if (!DATE) {
  console.error('Error: Date argument is required');
  process.exit(1);
}

const RESULTS_DIR = path.resolve('chart', 'results', DATE);
if (!fs.existsSync(RESULTS_DIR)) {
  console.error(`Error: Results directory ${RESULTS_DIR} does not exist`);
  process.exit(1);
}

// Colors for different package managers
const COLORS = {
  npm: '#cb0606',
  yarn: '#117cad',
  pnpm: '#f9ad00',
  berry: '#9555bb',
  deno: '#70ffaf',
  bun: '#f472b6',
  vlt: '#000000',
  nx: '#3b82f6',
  turbo: '#ff1e56',
  node: '#84ba64'
};

// Read and process results
function readResults(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data.results || !Array.isArray(data.results)) {
      console.warn(`Warning: Invalid results format in ${file}`);
      return [];
    }
    return data.results.map(r => ({
      command: r.command,
      mean: parseFloat(r.mean) || 0,
      stddev: parseFloat(r.stddev) || 0
    }));
  } catch (error) {
    console.warn(`Warning: Could not read results from ${file}:`, error.message);
    return [];
  }
}

// Generate chart data
function generateChartData(option = {}) {
  const fixtures = ['next', 'astro', 'svelte', 'vue', 'run'];
  const variations = [
    'cache',
    'cache+lockfile',
    'cache+lockfile+node_modules',
    'cache+node_modules',
    'clean',
    'lockfile',
    'lockfile+node_modules',
    'node_modules',
    'run'
  ];
  const result = {};

  // Process each variation
  variations.forEach(variation => {
    const datasets = [];
    const seenFixtures = new Set();

    Object.keys(COLORS).forEach(pm => {
      const data = [];
      const stddev = [];
      let countData = undefined;

      fixtures.forEach(fixture => {
        const file = path.resolve(RESULTS_DIR, `${fixture}-${variation}.json`);
        let count = undefined;

        // If perPackageCount is enabled, try to load the package count for this fixture/variation
        if (option.perPackageCount) {
          const countFile = path.resolve(
            RESULTS_DIR,
            `${fixture}-${variation}-package-count.json`
          );
          if (fs.existsSync(countFile)) {
            try {
              countData = JSON.parse(fs.readFileSync(countFile, 'utf8'));
              if (
                countData &&
                typeof countData === 'object' &&
                countData[pm] &&
                typeof countData[pm].count === 'number'
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
          const pmResult = results.find(r => r.command === pm);
          if (!pmResult?.mean) {
            return;
          }
          seenFixtures.add(fixture);

          let value = pmResult.mean;
          if (option.perPackageCount && typeof count === 'number' && count > 0) {
            value = (value / count) * 1000;
          }
          data.push(value);
          stddev.push(pmResult.stddev);
        }
      });

      if (data.length > 0) {
        datasets.push({
          ...((countData) ? { count: countData[pm].count } : {}),
          label: pm,
          data: data,
          stddev: stddev,
          backgroundColor: COLORS[pm],
          borderColor: COLORS[pm],
          borderWidth: 1
        });
      }
    });

    if (datasets.length > 0) {
      // Store chart data for this variation
      result[variation] = {
        labels: Array.from(seenFixtures),
        datasets: datasets
      };
    }
  });

  return {
    labels: Object.keys(result),
    result: result
  };
}

// Generate HTML with chart
function generateHtml(chartData, perPackageCountChartData) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Package Manager Benchmarks - ${DATE}</title>
    <link rel="stylesheet" href="styles.css">
    <style>
      .results-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 2em;
      }
      .results-table th, .results-table td {
        border: 1px solid #ccc;
        padding: 0.4em 0.7em;
        text-align: center;
      }
      .results-table th {
        background: #f3f3f3;
      }
      .results-table td:first-child, .results-table th:first-child {
        text-align: left;
        font-weight: bold;
        background: #fafafa;
      }
      .results-table tr:nth-child(even) td {
        background: #fcfcfc;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Package Manager Benchmarks</h1>
      <p class="date">Results from ${DATE}</p>
      <div class="tabs">
        ${chartData.labels.map((label, index) => 
          `<button class="tab-button ${index === 0 ? 'active' : ''}" onclick="showChart('${label}')">${label}</button>`
        ).join('')}
      </div>
      <h2 id="per-package-chart-title">
        Per-Package install time (milliseconds)
        <span id="variation-title-perpkg" style="font-weight: normal">
          with ${chartData.labels[0]}
        </span>
      </h2>
      <div class="chart-container">
        <canvas id="myChartPerPackage"></canvas>
      </div>
      <h2 id="main-title">
        Total install time (seconds)
        <span id="variation-title-total" style="font-weight: normal">
          with ${chartData.labels[0]}
        </span>
      </h2>
      <div class="chart-container">
        <canvas id="myChart"></canvas>
      </div>
      <h2>Summary</h2>
      <div id="results-table-container"></div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const chartData = ${JSON.stringify(chartData)};
      const perPackageCountChartData = ${JSON.stringify(perPackageCountChartData)};
      // Chart.js context for both charts
      const ctx = document.getElementById('myChart');
      const ctxPerPackage = document.getElementById('myChartPerPackage');
      let chart;
      let chartPerPackage;

      function showChart(variation) {
        // Update active tab
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const targetButton = Array.from(document.querySelectorAll('.tab-button')).find(btn => btn.textContent === variation);
        if (targetButton) {
          targetButton.classList.add('active');
        }

        // Update main title for "run" variation
        const mainTitle = document.getElementById('main-title');
        const totalTitleSpan = document.getElementById('variation-title-total');
        if (mainTitle) {
          if (variation === 'run') {
            mainTitle.innerHTML = 'Total run time (seconds)';
          } else {
            mainTitle.innerHTML = \`Total install time (seconds)
              <span id="variation-title-total" style="font-weight: normal">
                with \${variation}
              </span>\`;
          }
        }
        // Update variation titles in h2s (per-package)
        const perPkgTitleSpan = document.getElementById('variation-title-perpkg');
        if (perPkgTitleSpan) {
          perPkgTitleSpan.textContent = 'with ' + variation;
        }

        // Destroy existing chart if it exists
        if (chart) {
          chart.destroy();
        }
        if (chartPerPackage) {
          chartPerPackage.destroy();
        }

        // Get chart data for this variation
        const variationData = chartData.result[variation];
        if (!variationData) {
          console.error('No data found for variation:', variation);
        } else {
          chart = new Chart(ctx, {
            type: 'bar',
            data: variationData,
            options: {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Time (seconds)'
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = context.raw;
                      if (value === null) return \`\${context.dataset.label}: No data\`;
                      return \`\${context.dataset.label}: \${value.toFixed(2)}s\`;
                    }
                  }
                }
              }
            }
          });
        }

        // Get per-package chart data for this variation
        if (perPackageCountChartData && perPackageCountChartData.result && perPackageCountChartData.result[variation] && variation !== 'run') {
          document.getElementById('per-package-chart-title').style.display = 'block';
          const perPkgVariationData = perPackageCountChartData.result[variation];
          chartPerPackage = new Chart(ctxPerPackage, {
            type: 'bar',
            data: perPkgVariationData,
            options: {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Time (ms per package)'
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = context.raw;
                      if (value === null) return \`\${context.dataset.label}: No data\`;
                      return \`\${context.dataset.label}: \${value.toFixed(4)} ms/pkg\`;
                    }
                  }
                }
              }
            }
          });
        } else {
          // If no per-package data, clear the chart area
          if (ctxPerPackage && ctxPerPackage.getContext) {
            const c = ctxPerPackage.getContext('2d');
            c.clearRect(0, 0, ctxPerPackage.width, ctxPerPackage.height);
          }
          document.getElementById('per-package-chart-title').style.display = 'none';
        }
      }

      // --- Static Table Generation ---
      function generateResultsTable(chartData, perPackageCountChartData) {
        // Gather all unique PMs from datasets
        const allPMsSet = new Set();
        const excludePMs = new Set(['node', 'nx', 'turbo']);
        Object.values(chartData.result).forEach(variationObj => {
          if (variationObj && Array.isArray(variationObj.datasets)) {
            variationObj.datasets.filter(ds => !excludePMs.has(ds.label)).forEach(ds => allPMsSet.add(ds.label));
          }
        });
        const allPMs = Array.from(allPMsSet);

        // Gather all fixture+variation combinations
        // We'll use the labels (fixtures) and chartData.labels (variations)
        const rows = [];
        for (const variation of chartData.labels) {
          if (variation === 'run') continue; // do not render run results in summary table
          const variationObj = chartData.result[variation];
          const perPkgVariationObj = perPackageCountChartData.result[variation];
          if (!variationObj || !perPkgVariationObj) continue;
          const fixtures = variationObj.labels || [];
          for (const fixture of fixtures) {
            // For each PM, find the dataset for this fixture
            // The datasets' data arrays are in the same order as fixtures
            // We'll build a map: pm -> {count, totalInstall, singlePkgInstall}
            const pmData = {};
            for (const pm of allPMs) {
              // Find dataset for this pm
              const ds = variationObj.datasets.find(d => d.label === pm);
              const dsPerPkg = perPkgVariationObj.datasets.find(d => d.label === pm);
              // Find index of this fixture in labels
              const idx = variationObj.labels.indexOf(fixture);
              // Package count
              let count = null;
              if (dsPerPkg && typeof dsPerPkg.count === 'number') {
                count = dsPerPkg.count;
              }
              // Total install time (seconds)
              let totalInstall = null;
              if (ds && Array.isArray(ds.data) && ds.data[idx] !== undefined) {
                // Average over data array (should be one value per fixture)
                totalInstall = ds.data[idx];
              }
              // Single package install time (ms)
              let singlePkgInstall = null;
              if (dsPerPkg && Array.isArray(dsPerPkg.data) && dsPerPkg.data[idx] !== undefined) {
                singlePkgInstall = dsPerPkg.data[idx];
              }
              pmData[pm] = {
                count,
                totalInstall,
                singlePkgInstall
              };
            }
            // Add three rows: package count, total install, single package install
            rows.push({
              label: \`\${fixture} & \${variation} total package count\`,
              type: 'count',
              pmValues: allPMs.map(pm => pmData[pm]?.count != null ? pmData[pm].count : '')
            });
            rows.push({
              label: \`\${fixture} & \${variation} total install time\`,
              type: 'totalInstall',
              pmValues: allPMs.map(pm => {
                const v = pmData[pm]?.totalInstall;
                return v != null && !isNaN(v) ? v.toFixed(2) + 's' : '';
              })
            });
            rows.push({
              label: \`\${fixture} & \${variation} per-package install time\`,
              type: 'singlePkgInstall',
              pmValues: allPMs.map(pm => {
                const v = pmData[pm]?.singlePkgInstall;
                return v != null && !isNaN(v) ? v.toFixed(2) + 'ms' : '';
              })
            });
          }
        }

        // Build HTML table
        let html = '<table class="results-table">';
        html += '<thead><tr><th></th>' + allPMs.map(pm => ('<th>' + pm + '</th>')).join('') + '</tr></thead>';
        html += '<tbody>';
        for (const row of rows) {
          html += '<tr><td>' + row.label + '</td>' + row.pmValues.map(val => ('<td>' + val + '</td>')).join('') + '</tr>';
        }
        html += '</tbody></table>';
        return html;
      }

      // Render the static table once on page load
      document.addEventListener('DOMContentLoaded', function() {
        const tableHtml = generateResultsTable(chartData, perPackageCountChartData);
        document.getElementById('results-table-container').innerHTML = tableHtml;
      });

      // Initialize with first chart
      showChart(chartData.labels[0]);
    </script>
  </body>
</html>`;
}

// Main execution
try {
  const chartData = generateChartData();
  const perPackageCountChartData = generateChartData({ perPackageCount: true });
  console.log(require('util').inspect(chartData, { depth: null }));
  
  // Check if we have any data to display
  if (Object.keys(chartData.result).length === 0) {
    console.error('Error: No valid benchmark data found to generate chart');
    process.exit(1);
  }
  
  const html = generateHtml(chartData, perPackageCountChartData);
  
  // Write the generated HTML
  fs.writeFileSync(path.join(RESULTS_DIR, 'index.html'), html);
  
  console.log('Chart generation complete!');
} catch (error) {
  console.error('Error generating chart:', error);
  process.exit(1);
} 