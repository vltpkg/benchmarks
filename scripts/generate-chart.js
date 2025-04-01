const fs = require('fs');
const path = require('path');

const DATE = process.argv[2];
if (!DATE) {
  console.error('Error: Date argument is required');
  process.exit(1);
}

const RESULTS_DIR = path.join(__dirname, '..', 'chart', 'results', DATE);
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
  const projects = ['next', 'astro', 'svelte', 'vue'];
  const datasets = [];
  
  // Process each package manager
  Object.keys(COLORS).forEach(pm => {
    const data = [];
    const stddev = [];
    
    // Add project installation times
    projects.forEach(project => {
      const coldFile = path.join(RESULTS_DIR, `${project}-cold.json`);
      const warmFile = path.join(RESULTS_DIR, `${project}-warm.json`);
      
      let result = null;
      if (fs.existsSync(coldFile)) {
        const results = readResults(coldFile);
        result = results.find(r => r.command === pm);
      }
      
      data.push(result ? result.mean : null);
      stddev.push(result ? result.stddev : null);
    });
    
    // Add task execution time
    const taskFile = path.join(RESULTS_DIR, 'task-execution.json');
    let taskResult = null;
    if (fs.existsSync(taskFile)) {
      const results = readResults(taskFile);
      taskResult = results.find(r => r.command === pm);
    }
    
    data.push(taskResult ? taskResult.mean : null);
    stddev.push(taskResult ? taskResult.stddev : null);
    
    // Only add dataset if we have any valid data
    if (data.some(v => v !== null)) {
      datasets.push({
        label: pm,
        data: data,
        stddev: stddev,
        backgroundColor: COLORS[pm]
      });
    }
  });
  
  return {
    labels: [
      ...projects.map(p => `Install ${p} Project`),
      'Running Scripts'
    ],
    datasets: datasets
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
      <div class="chart-container">
        <canvas id="myChart"></canvas>
      </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      const chartData = ${JSON.stringify(chartData)};
      const ctx = document.getElementById('myChart');
      new Chart(ctx, {
        type: 'bar',
        data: chartData,
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
                  const stddev = context.dataset.stddev[context.dataIndex];
                  if (value === null) return \`\${context.dataset.label}: No data\`;
                  return \`\${context.dataset.label}: \${value.toFixed(2)}s (±\${stddev.toFixed(2)}s)\`;
                }
              }
            }
          }
        }
      });
    </script>
  </body>
</html>`;
}

// Main execution
try {
  const chartData = generateChartData();
  
  // Check if we have any data to display
  if (chartData.datasets.length === 0) {
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