# Package Manager Benchmarks

This repo contains a suite of fixtures & tools to track the performance of package managers. We benchmark various Node.js package managers (npm, yarn, pnpm, berry, deno, bun, vlt, nx, turbo) across different project types and scenarios.

## Environment

We currently only test the latest `linux` runner which is the most common GitHub Action environment. The [standard GitHub-hosted public runner environment](https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories) specs are below:

- VM: Linux
- Processor (CPU): 4
- Memory (RAM): 16 GB
- Storage (SSD): 14 GB
- Workflow label: `ubuntu-latest`

We may add Mac/Windows in the future but it will likely exponentially increase the already slow run time of the suite (**~40min**).

## Overview

The benchmarks measure:
- Per-package installation times
- Total Project installation times
- Run script execution performance
- Standard deviation of results

### Project Types (fixtures)
- Next.js
- Astro
- Svelte
- Vue
- Large
- Babylon.js (Massive 3D engine monorepo with 86+ packages)

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

The installation tests we run today mimic a matrix of different variations (cold cache, warm cache, cold cache with lockfile, etc) for a variety of test fixtures (ie. we install the packages of a `next`, `vue`, `svelte` & `astro` starter project).

#### Supported Tools

- `vlt`
- `npm`
- `pnpm`
- `yarn`
- `yarn berry`
- `deno`
- `bun`

## Testing Script Execution

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

- 1. Setup:

  - 1.1 Install `jq` using your OS package manager
  
  - 1.2 Install `hyperfine`, version >= 1.19.0 is required
  
  - 1.3 Install package managers and corepack:
    ```bash
    npm install -g npm@latest corepack@latest vlt@latest bun@latest deno@latest nx@latest turbo@latest
    ```
  
  - 1.4 Make a new `results` folder:
    ```bash
    mkdir -p results
    ```

- 2. Run benchmarks:

  ```bash
  # Install and benchmark a specific project
  bash ./scripts/benchmark.sh <fixture> <variation>

  # Example: Benchmark Next.js with cold cache
  bash ./scripts/benchmark.sh next clean
  ```

- 3. Local bench wrapper (optional):

  ```bash
  # One-time: make the wrapper executable
  chmod +x bench

  # Defaults: next + clean (uses script defaults for runs/warmup)
  ./bench run

  # Pick fixtures, package managers, and runs
  ./bench run --fixtures=next,astro --pms=vlt,pnpm --runs=3

  # Run all fixtures (except "run")
  ./bench run --fixtures=all --variation=clean

  # Script-execution benchmark
  ./bench run --variation=run --pms=vlt

  # Generate chart data (and copy to app/latest) after a run
  ./bench run --fixtures=next --runs=3 --chart

  # Process existing results into chart data
  ./bench chart --fixtures=next --variation=clean
  ```

  The wrapper filters failed runs by default; pass `--no-clean` to keep raw results.

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

Results are organized by date in the `YYYY-MM-DD/` directory:
- `<fixture>-<variation>.json`: Cold cache installation results
- `<fixture>-<variation>-package-count.json`: The count of packages installed for each package manager for a given fixture and variation
- `index.html`: Interactive visualization

### Visualization

The generated charts show:
- Per-package installation times for each fixture and variation combination
- Total installation times for each different combination
- Run scripts execution performance
- Standard deviation in tooltips
- Summary table with total installation times and package counts

### View Results Online

Results are automatically deployed to GitHub Pages when running on the main branch:

<https://vltpkg.github.io/benchmarks/>

Each run creates a new dated html file with its results, making it easy to track performance over time.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Local debugging

You can debug the result process scripts and the web app locally by using data
from previous [GitHub Action runs of the Package Manager Benchmarks workflow](https://github.com/vltpkg/benchmarks/actions/workflows/benchmark.yaml).

Those can be individually downloaded and their `benchmarks.json` files renamed
to a `results/<date>/<fixture>-<variation>.json` file, where `<date>` needs to
match a folder name in the `results` folder in a `YYYY-MM-DD` pattern and
`<fixture>` is one of the known project type fixtures and `<variation>` is one
of the known variations (e.g. `clean`, `cache`, `lockfile`, etc).

You may test the chart data generation script locally by running: 

```sh
node scripts/generate-chart.js <date>
```

Make sure you have a `results/<date>` directory with valid benchmark
result JSON files in it.

After a succesful run, test the web app rendering the chart data locally
by copying the result `results/<date>/chart-data.json` file to the
web app folder in a `latest/` folder, e.g: `app/latest/chart-data.json`

## License

This project is licensed under the BSD-2-Clause-Patent License - see the LICENSE file for details.
