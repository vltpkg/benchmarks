# AGENTS.md

Benchmark suite for Node.js package managers. Measures install time, script execution, and registry performance.

## Architecture

Two systems, one repo:

1. **Benchmark engine** (`bench`, `scripts/`, `fixtures/`) — bash + [hyperfine](https://github.com/sharkdp/hyperfine)
2. **Visualization app** (`app/`) — React 19 + Vite 7 + Recharts + Tailwind 4, deployed to GitHub Pages

Connected via `results/latest/chart-data.json` (gitignored). App reads `app/latest/chart-data.json` at runtime.

## Quick Commands

```bash
./bench run --fixtures=next --variation=clean     # run benchmarks
./bench process                                    # clean + process + chart data
./bench list                                       # show available fixtures/variations/PMs
cd app && npm install && npm run dev               # app at http://localhost:5173
```

Common flags: `--pms=vlt,pnpm`, `--runs=3`, `--warmup=2`, `--registries=npm,vlt`, `--clean`, `--dry-run`

## Data Pipeline

```
bench run          → hyperfine → results/<fixture>/<variation>/benchmarks.json
                   → collect-package-count.js → package-count.json
bench process      → clean-benchmarks.js (filter failures)
                   → process-results.sh (copy to results/latest/)
                   → generate-chart.js → results/latest/chart-data.json
app reads          → fetch('/latest/chart-data.json')
```

**`app/` builds to `../results/`** (not `dist/`). See `app/vite.config.ts`.

## Package Manager Gotchas

- **nx, turbo, vp, node** only run for `run`, `build`, `build-cache` variations (filtered in `scripts/variations/common.sh`)
- **Berry** = Yarn Berry (latest via corepack), **yarn** = Yarn Classic (v1 via corepack)
- **zpm** = Yarn v6 Canary (installed from `repo.yarnpkg.com`)
- **pnpm** and **pacquet** delete `packageManager` field before install to avoid corepack interference
- **vlt** runs `scripts/add-workspace-protocol.js` as setup to add `workspace:` protocol
- **bun** uses `--ignore-scripts`; berry/vlt/deno don't need it (don't run scripts by default)
- **large** fixture needs `--legacy-peer-deps` for npm (peer dep conflict: `medium-draft@0.5.18` requires react 15/16)
- **Registry benchmarks** always use `npm install` as the timed command, just pointed at different registries via `.npmrc`

## CI Behavior

- **Skips benchmarks** if only `app/`, `README.md`, `.editorconfig`, `.cursor/`, or `.github/` changed
- Non-main pushes: warmup=1, runs=1 (reduced). Main pushes / scheduled: warmup=2, runs=5
- `large`/`babylon` fixtures: warmup=1, runs=3 (heavy fixture tuning)
- Results deploy to GitHub Pages on main

## Adding a New Fixture

Update **all 7+ locations** (see `.cursor/rules/adding-new-fixtures.mdc`):

1. `fixtures/<name>/package.json` — create the fixture
2. `scripts/generate-chart.js` — add to `fixtures` array (~line 98)
3. `scripts/process-results.sh` — add to processing loops (~lines 103, 132)
4. `app/src/types/chart-data.ts` — add to `Fixture` type union
5. `app/src/hooks/use-package-count-data.ts` — add to fixtures array
6. `app/src/lib/utils.ts` — add to `sortFixtures` preferredOrder (~line 428)
7. `.github/workflows/benchmark.yaml` — add to default fixture lists and matrix
8. `app/src/lib/get-icons.ts` — optional icon mapping
9. `README.md` — document it

## Code Conventions

- All shell scripts: `set -Eeuxo pipefail`
- 2-space indent everywhere (enforced by `.editorconfig`)
- LF line endings, UTF-8
- JS scripts in `scripts/` use CommonJS (`require`), not ESM
- App uses ESM (`"type": "module"` in `app/package.json`)
- `clean-benchmarks.js` filters failed runs and recalculates mean/stddev from successful ones only

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BENCH_INCLUDE` | all PMs | Comma-separated PMs to benchmark |
| `BENCH_WARMUP` | 2 | Hyperfine warmup runs |
| `BENCH_RUNS` | 5 | Hyperfine measured runs |
| `BENCH_TIMEOUT` | 300 | Per-command timeout (seconds) |
| `BENCH_INCLUDE_REGISTRY` | npm,vlt,aws,github | Registries for registry-* variations |

## Results Structure

```
results/
├── <fixture>/<variation>/benchmarks.json    # hyperfine output (per-iteration)
├── <fixture>/<variation>/package-count.json # post-install package counts
├── <fixture>/<variation>/process-count.json # spawned process counts (strace)
├── versions.json                            # PM versions used in this run
├── <YYYY-MM-DD>/                           # dated processed results
│   ├── chart-data.json
│   └── <fixture>-<variation>.json
└── latest/                                 # most recent processed run
```

All of `results/`, `app/latest/`, `versions-temp/` are gitignored.

## Gotchas

- **Vite SPA fallback hides missing data**: When `app/latest/chart-data.json` doesn't exist, Vite serves `index.html` (200 OK) instead of 404. `response.ok` passes but `response.json()` throws `Unexpected token '<', "<!doctype "...`. Create a placeholder: `mkdir -p app/latest && echo '{"date":"","chartData":{"variations":[],"data":{},"packageManagers":[],"colors":{}},"perPackageCountChartData":{"variations":[],"data":{},"packageManagers":[],"colors":{}}}' > app/latest/chart-data.json`
- **`devEngines.packageManager` auto-pinning**: corepack 0.34+ pins `devEngines.packageManager` into `package.json`. npm/pnpm enforce this field and refuse to run (`EBADDEVENGINES`). `clean_package_manager_field()` strips it, but **must run AFTER `clean_all_cache`** because corepack cache cleans re-pin it.
- **`hyperfine` version**: Needs `>= 1.19.0` for `--conclude` flag. Ubuntu apt ships 1.18.0. Setup script installs from GitHub releases.
- **Registry auth token randomization**: vlt registry appends random suffix to auth token per iteration to bust cache. `HYPERFINE_ITERATION` is available in `--prepare` but NOT in `--conclude` hooks.
- **`babylon` fixture has `setup.sh`**: Registry common.sh runs `bash setup.sh` for babylon before benchmarks. Other fixtures don't have this.
- **Order of `clean_all` operations**: `clean_package_manager_field` must run last in `clean_all` because `clean_all_cache` (which runs corepack) re-pins `devEngines.packageManager` into `package.json`.
- **`pnpm11` in chart colors but not in bench**: `generate-chart.js` includes `pnpm11` in COLORS map, but `bench` only lists `pnpm` (uses `corepack pnpm@latest`). Likely v11 IS the latest — treat `pnpm` as `pnpm11`.
- **`aube` may not install on all platforms**: Setup script catches failure with `|| true`. Non-fatal.
- **`--ignore-failure` masks timeouts**: Each install wrapped with `timeout $BENCH_TIMEOUT`. Timeout records as failure, suite continues. Check exit codes in `benchmarks.json` to distinguish real failures from timeouts.
- **Process count via strace**: Linux only. `collect_process_count` checks `command -v strace` and skips on macOS. Process count column in charts will be empty on macOS.
