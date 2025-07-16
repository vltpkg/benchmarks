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
function generateChartData() {
  const fixtures = ['next', 'astro', 'svelte', 'vue'];
  const variations = ['cache', 'cache+lockfile', 'cache+lockfile+node_modules', 'cache+node_modules', 'clean', 'lockfile', 'lockfile+node_modules', 'node_modules', 'run'];
  const result = {};
  
  // Process each variation
  variations.forEach(variation => {
    const datasets = [];
    
    // Process each package manager
      const seenFixtures = new Set();
    Object.keys(COLORS).forEach(pm => {
      const data = [];
      const stddev = [];
        
      // Collect data for this package manager across all fixtures
      fixtures.forEach(fixture => {
        const file = path.resolve(RESULTS_DIR, `${fixture}-${variation}.json`);
        
        if (fs.existsSync(file)) {
          const results = readResults(file);
          const pmResult = results.find(r => r.command === pm);
          if (!pmResult?.mean) {
            return;
          }
          seenFixtures.add(fixture);
          data.push(pmResult.mean);
          stddev.push(pmResult.stddev);
        }
      });
      
      if (data.length > 0) {
        datasets.push({
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
function generateHtml(chartData) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Package Manager Benchmarks - ${DATE}</title>
    <link rel="stylesheet" href="styles.css">
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
      <div class="chart-container">
        <canvas id="myChart"></canvas>
      </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const chartData = ${JSON.stringify(chartData)};
      const ctx = document.getElementById('myChart');
      let chart;
      
      function showChart(variation) {
        // Update active tab
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const targetButton = Array.from(document.querySelectorAll('.tab-button')).find(btn => btn.textContent === variation);
        if (targetButton) {
          targetButton.classList.add('active');
        }
        
        // Destroy existing chart if it exists
        if (chart) {
          chart.destroy();
        }
        
        // Get chart data for this variation
        const variationData = chartData.result[variation];
        if (!variationData) {
          console.error('No data found for variation:', variation);
          return;
        }
        
        // Create new chart with selected dataset
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
      
      // Initialize with first chart
      showChart(chartData.labels[0]);
    </script>
  </body>
</html>`;
}

// Main execution
try {
  const chartData = generateChartData();
  console.log(require('util').inspect(chartData, { depth: null }));
  
  // Check if we have any data to display
  if (Object.keys(chartData.result).length === 0) {
    console.error('Error: No valid benchmark data found to generate chart');
    process.exit(1);
  }
  
  const html = generateHtml(chartData);
  
  // Write the generated HTML
  fs.writeFileSync(path.join(RESULTS_DIR, 'index.html'), html);
  
  console.log('Chart generation complete!');
} catch (error) {
  console.error('Error generating chart:', error);
  process.exit(1);
} 