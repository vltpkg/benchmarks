# Package Manager Benchmarks

This repo contains a suite of fixtures & tools to track the performance of package managers. We benchmark various Node.js package managers (npm, yarn, pnpm, berry, deno, bun, vlt, nx, turbo) across different project types and scenarios.

## Environment

We currently only test the latest `linux` runner which is the most common GitHub Action environment. The [standard GitHub-hosted public runner environment](https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories) specs are below:

- VM: Linux
- Processor (CPU): 4
- Memory (RAM): 16 GB
- Storage (SSD): 14 GB
- Workflow label: `ubuntu-latest`

We may add Mac/Windows in the future but it will likely exponentially increase the already slow run time of the suite (**~20min**).

## Overview

The benchmarks measure:
- Project installation times (cold and warm cache)
- Task execution performance
- Standard deviation of results

### Project Types
- Next.js
- Astro
- Svelte
- Vue

### Package Managers
- npm
- yarn
- pnpm
- Yarn Berry
- Deno
- Bun
- VLT
- NX
- Turbo
- Node.js

## Configuration/Normalization

We do a best-effort job to configure each tool to behave as similar as possible to its peers but there's limitations to this standardization in many scenarios (as each tool makes decisions about its default support for security checks/validations/feature-set). As part of the normalization process, we count the number of packages - post-installation - & use that to determine the average speed relative to the number of packages installed. This strategy helps account for when there are significant discrepancies between the package manager's dependency graph resolution ([you can read/see more here](https://docs.google.com/presentation/d/1ojXF4jb_1MyGhew2LCbdrZ4e_0vYUr-7CoMJLJsHwZY/edit?usp=sharing)).

#### Example:
- **Package Manager A** installs **1,000** packages in **10s** -> an avg. of **~10ms** per-package
- **Package Manager B** installs **10** packages in **1s** -> an avg. of **~100ms** per-package

## Testing Package Installation

The installation tests we run today mimic a cold-cache scenario for a variety of test fixtures (ie. we install the packages of a `next`, `vue`, `svelte` & `astro` starter project). We will likely add lockfile & warm cache tests in the near future.

#### Supported Tools

- `vlt`
- `npm`
- `pnpm`
- `yarn`
- `yarn berry`
- `deno`
- `bun`

## Testing Script Execution (WIP)

This suite also tests the performance of basic script execution (ex. `npm run foo`). Notably, for any given build, test or deployment task the spawning of the process is a fraction of the overall execution time. That said, this is a commonly tracked workflow by various developer tools as it involves the common set of tasks: startup, filesystem read (`package.json`) & finally, spawning the process/command.

#### Supported Tools

- `vlt`
- `npm`
- `pnpm`
- `yarn`
- `yarn berry`
- `deno`
- `bun`
- `node`
- `turborepo`
- `nx`

## Running Benchmarks

### Local Development

1. Install dependencies:
```bash
bash ./scripts/setup.sh
```

2. Run benchmarks:
```bash
# Install and benchmark a specific project
bash ./scripts/install.sh <project>  # cold cache
bash ./scripts/install-warm.sh <project>  # warm cache

# Run task execution benchmarks
bash ./scripts/run.sh
```

### GitHub Actions

The benchmarks run automatically on:
- Push to main branch
- Manual workflow trigger

The workflow:
1. Sets up the environment with all package managers
2. Runs benchmarks for each project type (cold and warm cache)
3. Executes task performance benchmarks
4. Processes results and generates visualizations
5. Deploys results to GitHub Pages (main branch only)

## Results

### Console Output

Each benchmark run provides a summary in the console:
```
=== Project Name (cache type) ===
package-manager: X.XXs (stddev: X.XXs)
...
```

### Generated Results

Results are organized by date in the `chart/results/YYYY-MM-DD/` directory:
- `project-cold.json`: Cold cache installation results
- `project-warm.json`: Warm cache installation results
- `task-execution.json`: Task execution benchmark results
- `index.html`: Interactive visualization
- `styles.css`: Chart styling
- `script.js`: Chart configuration

### Visualization

The generated charts show:
- Installation times for each project type
- Task execution performance
- Standard deviation in tooltips
- Missing data handling
- Responsive design

### GitHub Pages

Results are automatically deployed to GitHub Pages when running on the main branch:
```
https://<username>.github.io/<repo>/results/
```

Each run creates a new dated directory with its results, making it easy to track performance over time.

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── benchmark.yaml    # GitHub Actions workflow
├── chart/
│   ├── results/             # Generated results
│   ├── index.html           # Chart template
│   ├── styles.css           # Chart styling
│   └── script.js            # Chart configuration
├── scripts/
│   ├── setup.sh             # Environment setup
│   ├── install.sh           # Cold cache installation
│   ├── install-warm.sh      # Warm cache installation
│   ├── run.sh               # Task execution
│   ├── process-results.sh   # Results processing
│   └── generate-chart.js    # Chart generation
└── results/                 # Raw benchmark results
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
