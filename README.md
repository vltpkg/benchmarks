# Package Manager Benchmarks

This repo contains a suite of fixtures & tools to track the performance of package managers. We benchmark various Node.js package managers (npm, yarn, pnpm, berry, deno, bun, vlt, aube, upm, nx, turbo) across different project types and scenarios.

## Documentation

| Document                                   | For                                                      |
| ------------------------------------------ | -------------------------------------------------------- |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | what is measured, how, and what the published data means |
| [docs/FIXTURES/](docs/FIXTURES/README.md)  | one page per fixture                                     |

Two things that surprise most newcomers, both documented above: `suite/results/`
is the **only** results tree — measured into, indexed in place and published from,
with no copy step anywhere — and `./suite/bench process` can report success while
taking no new measurements.

## Environment

We currently only test a `linux` runner, the most common GitHub Actions
environment. The workflow label is read from the workflows themselves — all six
benchmark jobs in `.github/workflows/benchmark.yaml` and
`.github/workflows/reprocess.yml` set `runs-on: ubuntu-24.04-arm`:

- Workflow label: `ubuntu-24.04-arm`
- VM: Linux (Ubuntu 24.04)
- Architecture: `arm64`
- Processor (CPU): 4 cores
- Memory (RAM): 16 GB
- Storage (SSD): 14 GB

The label and the architecture come from the workflows. The remaining figures
are GitHub's [published specification for standard public
runners](https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners#standard-github-hosted-runners-for-public-repositories),
not measurements taken here.

> This section said `ubuntu-latest` until 2026-10-02, with the x64 specs under
> it. The suite has been running on arm since the move to arm runners, so the
> published methodology was describing a different machine than the one
> producing the numbers. If you are comparing these results against your own,
> that difference matters more than any of the figures above.

We may add Mac/Windows in the future but it will likely exponentially increase the already slow run time of the suite (**~40min**).

## Overview

The benchmarks measure:

- Per-package installation times
- Total Project installation times
- Run script execution performance
- Standard deviation of results

### Project Types (fixtures)

Seven, each with [its own page](docs/FIXTURES/README.md):

- [Next.js](docs/FIXTURES/NEXT.md) — the default fixture; the only one with `build` variations
- [Astro](docs/FIXTURES/ASTRO.md) — smallest install, one declared dependency
- [Svelte](docs/FIXTURES/SVELTE.md) — entirely devDependencies
- [Vue](docs/FIXTURES/VUE.md) — heaviest framework starter
- [Large](docs/FIXTURES/LARGE.md) — 109 direct dependencies, no application
- [Babylon.js](docs/FIXTURES/BABYLON.md) — monorepo, 86 workspace packages
- [Run](docs/FIXTURES/RUN.md) — script execution only, no dependencies

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
- `aube`
- `upm`

#### Supported Registries

Registry benchmarking is available in the `registry-clean` and `registry-lockfile` variations.

- `npm` (`https://registry.npmjs.org/`)
- `vlt` (`https://registry.vlt.io/vlt-benchmarks/npm/`)
- `aws` (CodeArtifact benchmark registry)

Defaults:

- Local and CI run `npm,vlt,aws` by default for `registry-*` variations.
- You can limit registries with `--registries` (wrapper) or `BENCH_INCLUDE_REGISTRY` (script-level env).

Examples:

```bash
# Run only npm + vlt registry benchmarks
./suite/bench run --variation=registry-clean --fixtures=next --registries=npm,vlt

# Run only aws registry benchmarks (requires token)
CODEARTIFACT_AUTH_TOKEN=<token> ./suite/bench run --variation=registry-clean --fixtures=next --registries=aws
```

Auth notes:

- `aws` requires `CODEARTIFACT_AUTH_TOKEN`.

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
- `aube`
- `upm`
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
  - 1.4 No directory setup is needed. `./suite/bench` creates its output tree at
    `suite/results/`, which is the only results tree there is.

- 2. Run benchmarks:

  ```bash
  # Install and benchmark a specific project
  ./suite/bench run --fixtures=<fixture> --variation=<variation>

  # Example: Benchmark Next.js with cold cache
  ./suite/bench run --fixtures=next --variation=clean
  ```

- 3. Local bench wrapper options:

  ```bash
  # Defaults: next + clean (uses script defaults for runs/warmup)
  ./suite/bench run

  # Pick fixtures, package managers, and runs
  ./suite/bench run --fixtures=next,astro --pms=vlt,pnpm --runs=3

  # Run all fixtures (except "run")
  ./suite/bench run --fixtures=all --variation=clean

  # Run multiple variations in one command
  ./suite/bench run --fixtures=svelte --variation=lockfile,registry-lockfile,run --registries=npm,vlt

  # Script-execution benchmark
  ./suite/bench run --variation=run --pms=vlt

  # Clean failed runs immediately during run/chart (optional)
  ./suite/bench run --fixtures=next --variation=clean --clean

  # Generate chart data (and copy to tmp/app/latest) after a run
  ./suite/bench run --fixtures=next --runs=3 --chart

  # Run benchmarks then process outputs in one command
  ./suite/bench run --fixtures=next --runs=3 --process

  # Process existing results into chart data
  ./suite/bench chart --fixtures=next --variation=clean
  ```

  By default, cleaning happens during `./suite/bench process`. Use `--clean` on `run`/`chart` for immediate cleanup.

- 4. Process benchmark output:

  ```bash
  # Filter failed runs and generate dated + latest outputs and chart data
  ./suite/bench process
  # Or pass --process directly when running
  ./suite/bench run --fixtures=next --runs=3 --process
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

You can debug the result processing scripts and the web app locally using data
from previous [GitHub Action runs of the Package Manager Benchmarks workflow](https://github.com/vltpkg/benchmarks/actions/workflows/benchmark.yaml).

Preferred workflow (matches CI):

1. Install and authenticate GitHub CLI (`gh auth login`).
2. Download artifacts from the latest successful run on `main`:

   ```sh
   ./suite/scripts/download-latest-artifacts.sh
   ```

   This keeps artifact-style directories such as
   `suite/results/results-<fixture>-<variation>/` and `suite/versions-temp/`.

3. Process downloaded artifacts:

   ```sh
   ./suite/bench process
   ```

   This cleans benchmark outputs, builds dated and latest result folders,
   and generates chart data (`suite/results/<date>/chart-data.json` and
   `suite/results/latest/chart-data.json`).

4. Index and serve the data, then run the current app:

   ```sh
   node apps/data/bin/build-manifest.mts --out suite/results suite/results
   node apps/data/bin/serve.mts --root suite/results --port 8811
   vlt run --workspace=apps/www build && vlt run --workspace=apps/www start
   ```

   The current frontend (`apps/www`) fetches from `apps/data` over HTTP, so
   there is **no chart-data file to copy**. Steps 4 and 5 of the instructions
   the download script prints are for `tmp/app/`, the parked previous app, and
   no longer apply.

## License

This project is licensed under the BSD-2-Clause-Patent License - see the LICENSE file for details.
