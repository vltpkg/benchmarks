# Methodology

How the benchmark suite measures package managers, and what the published data
means. Read this before trusting a number off the site.

See [`FIXTURES/`](FIXTURES/README.md) for one page per fixture.

## What a benchmark is here

One measurement is a **(fixture, variation, tool)** triple, timed by
[hyperfine](https://github.com/sharkdp/hyperfine).

- A **fixture** is a real project whose dependencies get installed — seven of
  them, from a one-dependency Astro starter to the 86-package Babylon.js
  monorepo. See [`FIXTURES/`](FIXTURES/README.md).
- A **variation** is the starting state and the command: cold cache, warm
  cache, lockfile present, `node_modules` present, and so on.
- A **tool** is a package manager (or, for `registry-*` variations, a registry).

hyperfine runs each command `BENCH_WARMUP` times to warm up, then `BENCH_RUNS`
times for real, and writes every individual timing. The suite passes
`--ignore-failure`, so a tool that fails is still timed and its non-zero exit
code is recorded rather than aborting the run. That is why `exit_codes` is part
of every result and why some series are marked "did not finish".

Defaults, from `.github/workflows/benchmark.yaml`:

| Trigger                               | warmup | runs | fixtures                 |
| ------------------------------------- | ------ | ---- | ------------------------ |
| scheduled / dispatch / push to `main` | 2      | 5    | all six install fixtures |
| push to a non-`main` branch           | 1      | 1    | `next astro vue svelte`  |

Only the first row publishes. Between runs the suite resets state with
`suite/scripts/clean-helpers.sh`, via hyperfine's `--prepare`, `--conclude` and
`--cleanup` hooks. `--conclude` is also where package counting happens, so
counts are taken from a real installed tree rather than inferred from a
lockfile.

## Normalization: why per-package time matters

Package managers disagree about what a dependency graph contains. Comparing
wall-clock install time alone rewards a tool that installs fewer packages.

So the suite counts packages actually installed, per tool, per fixture, per
variation, and the site reports both total time and time per package:

- Manager A installs **1,000** packages in **10s** → ~**10ms** per package
- Manager B installs **10** packages in **1s** → ~**100ms** per package

B is faster on the clock and ten times slower per unit of work. Both numbers
are published; neither alone is the answer.

## Variations

| Variation                     | Starting state / what it measures                           |
| ----------------------------- | ----------------------------------------------------------- |
| `clean`                       | nothing cached, no lockfile, no `node_modules` — worst case |
| `cache`                       | warm cache only                                             |
| `lockfile`                    | lockfile present, no cache, no `node_modules`               |
| `node_modules`                | `node_modules` present                                      |
| `cache+lockfile`              | cache and lockfile                                          |
| `cache+node_modules`          | cache and `node_modules`                                    |
| `lockfile+node_modules`       | lockfile and `node_modules`                                 |
| `cache+lockfile+node_modules` | everything warm — best case                                 |
| `ci`                          | the tool's CI-oriented install (`npm ci` and equivalents)   |
| `build`                       | a project build after install (`next` only, see below)      |
| `build-cache`                 | a project build with a warm build cache (same)              |
| `run`                         | script-execution overhead (`run` fixture only)              |
| `registry-clean`              | `clean`, comparing **registries** instead of managers       |
| `registry-lockfile`           | `lockfile`, comparing **registries**                        |

Each has a script in `suite/scripts/variations/`. **The variation name is the
filename in the published data**, and several contain `+`, which must be
percent-encoded in a URL path segment.

`build` and `build-cache` are scheduled for `next` alone, but on 10 dates
between 2026-05-09 and 2026-08-03 they ran for all six install fixtures, so
`astro-build.json` and its siblings exist in the archive. `run-run` is the only
`*-run.json` pair anywhere.

The published data can also hold variations the suite does not run, and the two
drift: `ci+setup` was published from 2026-09-30, before this workspace's suite
caught up with it. Discover variations from the data, never from a hardcoded
list.

## Registry variations

`registry-clean` and `registry-lockfile` hold the package manager constant and
vary the **registry**, to measure registry performance rather than client
performance. Registries observed in the published data: `npm`, `vlt`, `aws`,
`cloudsmith`, `github`, `jfrog`.

- Their package-count files are keyed by **registry name**, not by package
  manager, even though the filename pattern is identical.
- They publish **no process-count file**.

`aws` requires `CODEARTIFACT_AUTH_TOKEN`. Locally you can narrow the set with
`--registries`.

## Script execution: the `run` fixture

Spawning a process is a small part of any real build, but it is a workflow
developers hit constantly: start up, read `package.json`, spawn the command. The
`run` fixture exists only for that. Its `package.json` has no dependencies and
one script that echoes, so the measurement is startup and spawn, nothing else.

`node`, `nx` and `turbo` appear as series here and not in install benchmarks.

## The published data

The `gh-pages` branch **is** the API: a static JSON tree, one directory per
nightly run since 2025-08-22.

```
/{date}/{fixture}-{variation}.json                 hyperfine results
/{date}/{fixture}-{variation}-package-count.json   packages installed, per series
/{date}/{fixture}-{variation}-process-count.json   processes spawned, per series
/{date}/chart-data.json                            precomputed chart input
/{date}/versions.json                              tool versions for that run
/latest/                                           see below — NOT a copy
/index.json  /manifest.json  /manifest/{date}.json discovery layer
```

[`packages/types`](../packages/types/src/index.ts) encodes these shapes and is
the authority.

### Discover, never enumerate

Dates come from `index.json`'s `dates`, the newest from its `latest`, and the
fixture/variation pairs for a date from `manifest/{date}.json`. The archive is
not contiguous — dozens of days have no directory — so iterating a date range
instead of reading `dates` produces 404s.

Do not trust `chart-data.json`'s own `variations` and `packageManagers` lists
for what exists either: on 2026-04-14 it lists `registry-*` rows for all six
fixtures while the directory holds no `registry-*` files at all.

### A missing file is an answer

Not every benchmark file has both sibling files:

- `registry-*` variations publish no process-count.
- `build`, `build-cache` and `run` publish neither a package-count nor a
  process-count — they measure a script, not an install.
- `latest/` has no `versions.json`.

Render that absence as absence, not as `0`.

### `latest/` is not an alias for the newest date

The deploy merges rather than replaces, so `latest/` **accumulates** files left
over from earlier runs. Treat it as its own directory with its own contents.

### `chart-data.json` fields

Only `chartData` and `perPackageCountChartData` appear on every date. `versions`,
`date`, `registryChartData`, `commitSha` and `registryPerPackageCountChartData`
were added over time and are absent from older dates.

A chart row is a `fixture` key plus per-series keys. For a series `s`: `s`
(mean, seconds), `s_fill` (colour), `s_stddev`, and optionally `s_count`
(package count, per-package sections only) and `s_dnf` (true when the series
did not finish; present from 2026-02-04). Any of these can be missing for a
given row.

### A result has ten fields

`command`, `mean`, `stddev`, `median`, `min`, `max`, `user`, `system`, `times`,
`exit_codes`. Times are seconds, sometimes encoded as integers.

### The discovery layer

| File                   | Answers                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `index.json`           | which dates exist, and every fixture/variation seen anywhere |
| `manifest/{date}.json` | what is in **this** directory (or `latest`)                  |
| `manifest.json`        | the same for every directory at once (~840KB)                |

For a single date, fetch `index.json` plus that date's shard (~12KB), not the
whole manifest.
