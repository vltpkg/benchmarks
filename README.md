# Package Manager Benchmarks

This repo contains a suite of fixtures & tools to track the performance of package managers. We benchmark various Node.js package managers (npm, yarn, pnpm, berry, deno, bun, vlt, aube, nx, turbo) across different project types and scenarios.

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
- `aube`

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
./bench run --variation=registry-clean --fixtures=next --registries=npm,vlt

# Run only aws registry benchmarks (requires token)
CODEARTIFACT_AUTH_TOKEN=<token> ./bench run --variation=registry-clean --fixtures=next --registries=aws
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
  ./bench run --fixtures=<fixture> --variation=<variation>

  # Example: Benchmark Next.js with cold cache
  ./bench run --fixtures=next --variation=clean
  ```

- 3. Local bench wrapper options:

  ```bash
  # Defaults: next + clean (uses script defaults for runs/warmup)
  ./bench run

  # Pick fixtures, package managers, and runs
  ./bench run --fixtures=next,astro --pms=vlt,pnpm --runs=3

  # Run all fixtures (except "run")
  ./bench run --fixtures=all --variation=clean

  # Run multiple variations in one command
  ./bench run --fixtures=svelte --variation=lockfile,registry-lockfile,run --registries=npm,vlt

  # Script-execution benchmark
  ./bench run --variation=run --pms=vlt

  # Clean failed runs immediately during run/chart (optional)
  ./bench run --fixtures=next --variation=clean --clean

  # Generate chart data (and copy to app/latest) after a run
  ./bench run --fixtures=next --runs=3 --chart

  # Run benchmarks then process outputs in one command
  ./bench run --fixtures=next --runs=3 --process

  # Process existing results into chart data
  ./bench chart --fixtures=next --variation=clean
  ```

  By default, cleaning happens during `./bench process`. Use `--clean` on `run`/`chart` for immediate cleanup.

- 4. Process benchmark output:

  ```bash
  # Record run outcomes, filter failed timings, and generate dated + latest output
  ./bench process
  # Or pass --process directly when running
  ./bench run --fixtures=next --runs=3 --process
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

### Failed and partial runs

Processed benchmark results retain `original_exit_codes`, `attempted_runs`,
`successful_runs`, `dropped_runs`, and a `status` of `success`, `partial`, or
`failure`. These counts refer to measured runs, excluding Hyperfine warmups.
Cleaning the same output again preserves the original counts and exit codes.
The existing `times` and `exit_codes` arrays contain successful runs; total
failure keeps the existing zero-time DNF sentinel for compatibility.

Partial timing statistics describe the successful runs only. A single survivor
has `stddev: null` because it cannot establish variability. CPU `user` and
`system` fields are omitted whenever runs were dropped: Hyperfine exports only
aggregate CPU values, which cannot be recalculated for the surviving sample.

Chart data adds optional `<command>_partial`, `<command>_attempted_runs`,
`<command>_successful_runs`, and `<command>_dropped_runs` fields in both total and
per-package datasets. Tables and chart notices label partial results with their
success counts. Synthetic averages retain that warning and omit the affected
command's value. Commands with any
partial result in the selected comparisons are excluded from timing rankings;
registry win rankings retain the common denominator and award no wins for
incomplete fixtures. History omits that command's affected daily variation and
category average.

This is an additive schema change. Historical JSON without these fields remains
readable, but its completeness is unknown: failed attempts discarded by older
processing cannot be reconstructed. Regenerate from raw benchmark artifacts to
recover counts when those artifacts are still available. CI checks that inspect
raw `exit_codes` must run before `./bench process`; the registry failure scan
already does so. Persisted original codes also remain available in dated result
files on gh-pages.
### Timing statistic and sample quality

The canonical timing is the **median of successful measured runs** for each
fixture, variation, and tool/registry. For `[3, 4, 294]` seconds, the chart shows
4 seconds instead of the 100.3-second mean. No successful outlier is discarded:
the table reports the successful/attempted sample count and full observed range
(3–294 seconds here). The range is descriptive, not a confidence interval;
three samples provide limited evidence, even when their median looks stable.

The first **measured** run (run 0) is intentionally included. We do not assume
that it is a warmup or steady-state run: each variation controls its cache and
lockfile preparation. Explicit Hyperfine warmups are excluded from `times` and
therefore from the median and sample count. A one-run result is labeled 1/1;
its equal min/max does not imply certainty.

Dated and latest raw results retain mean, median, standard deviation, and
individual successful timings. Chart data uses the median (seconds), or the
same median multiplied by 1000 and divided by package count (ms/package).
Failed attempts are excluded from timing statistics but retained in completeness
metadata. Partial survivor samples are labeled and excluded from averages,
history, leaderboard timing/win calculations, and registry speed alerts.
All-failed results remain DNF; timing leaderboards' DNF penalty uses the
slowest successful median for that fixture.

Average views and leaderboard timing values are arithmetic averages of
per-benchmark medians, **not pooled medians**. History averages those medians
across available fixtures, and category history additionally averages across
variations. Coverage may vary by date; neither an averaged standard deviation
nor an invented confidence interval is shown for aggregates.

Older chart files without statistic metadata remain readable in the latest
view and are labeled **legacy mean**. They are omitted from median history to
avoid a false trend at the methodology change. Reprocessing the original dated
results regenerates median points from `times` or stored `median`; a mean-only
raw result stays labeled `legacy-mean` and cannot be converted to a median.

### Console Output

Each benchmark run provides a summary in the console:

```
=== Project Name (cache type) ===
package-manager: 4s (median; 3/3 successful runs; range 3s–294s)
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

Registry history uses total installation time in seconds from `registryChartData`, with legacy registry entries in `chartData` as a fallback. Dates containing only normalized registry data are omitted from the seconds chart because those values are measured in milliseconds per package.

### View Results Online

Registry leaderboard cards rank registries by **fixture wins**, not an average
installation time. Each selected fixture/variation pair counts once, so a large
fixture has the same influence as a small fixture. The `average` tab counts pairs
from both registry variations. Cards show wins out of the number of selected
pairs; filtering fixtures recomputes both values. Tool toggles only hide cards:
wins are always measured against all registries in the data.

The fastest complete positive timing earns a win; exact ties each earn a win
and share a rank (ordered alphabetically). Failed (DNF), partial, missing, and
invalid results earn no wins and receive no invented timing penalty. They remain
in the common denominator, including pairs where every registry failed. A card
with incomplete coverage also shows its number of complete results. This summary
describes how often a registry wins, not the magnitude of its speed advantage;
the fixture charts provide the underlying timings.

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
   ./scripts/download-latest-artifacts.sh
   ```

   This keeps artifact-style directories such as
   `results/results-<fixture>-<variation>/` and `versions-temp/`.

3. Process downloaded artifacts:

   ```sh
   ./bench process
   ```

   This cleans benchmark outputs, builds dated and latest result folders,
   and generates chart data (`results/<date>/chart-data.json` and `results/latest/chart-data.json`).

4. Copy the latest chart data into the app:

   ```sh
   mkdir -p app/latest
   cp results/latest/chart-data.json app/latest/chart-data.json
   ```

5. Run the app:

   ```sh
   cd app
   vlt install
   vlr dev
   ```

## License

This project is licensed under the BSD-2-Clause-Patent License - see the LICENSE file for details.
