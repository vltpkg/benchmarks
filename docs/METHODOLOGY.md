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

Each tool is measured in its **default configuration**, the experience a user
gets out of the box. For vlt that is its own registry: every fixture's
`vlt.json` points vlt at `https://registry.vlt.io/vlt-benchmarks/npm/`, and the
workflow authenticates to it (`VLT_REGISTRY`, `VLT_TOKEN`), while the other
tools use `registry.npmjs.org`. Some of vlt's features, such as server-side
resolution, only exist on its registry, so this is the comparison we intend.
vlt can also be pointed at `registry.npmjs.org`; these numbers don't measure
that. The `registry-*` variations are the ones that hold the client constant
and compare registries.

Fixtures are installed as committed, with the same dependency specs for every
tool (berry and zpm still get their `packageManager` pin and `.yarnrc.yml`).
In `babylon`, workspace packages depend on each other by plain semver range
(`"@dev/core": "^1.0.0"`), not `workspace:`, and each tool links them its own
way:

- vlt rewrites most of those ranges (257 of 323) to `workspace:*` in
  `package.json` on its first install. That rewrite is part of its timed run
  wherever the manifests start out unmigrated, which is `clean`; in the other
  variations the untimed first warmup migrates them. vlt 1.8.0 leaves the 66
  exact and peer specs on the published `@babylonjs/*` names as they are, and
  in about half of cold installs it resolves four of them (`gui`, `loaders`,
  `materials`, `serializers`) to registry copies instead of the workspace,
  downloading 4 extra tarballs ([vltpkg/vltpkg#2154](https://github.com/vltpkg/vltpkg/issues/2154)).
  So vlt's `babylon` `clean` results can differ between runs until that is
  fixed.
- pnpm links them (the fixture's `pnpm-workspace.yaml` sets
  `linkWorkspacePackages: true`), but first asks the registry for each one:
  about 240 lookups per cold install, most answered 404 for private packages.
  It also installs `@babylonjs/shared-ui-components`, a peer dependency, from
  the registry.
- Every tool downloads `babylonjs-gltf2interface@6` from the registry, because
  `packages/tools/devHost` asks for `^6.42.0` and the workspace has 8.49.6.

vlt finishes some work in detached processes that keep running after the
`vlt` command exits: unpacking fetched tarballs into its cache (about 19
seconds after a cold `babylon` install), revalidating cached manifests,
deleting replaced `node_modules` entries, and update checks
(`suite/scripts/vlt-background.sh`). The timed run ends when `vlt` exits,
which is when a user gets their prompt back. So that this deferred work can't
overlap the next timed run (of any manager) or write into a cache that is
being cleaned, every `--prepare`, `--setup` and `--cleanup` first waits for it
to finish, and every `--prepare` waits again right before the timed command
(`suite/scripts/hyperfine-wait.sh`, `wait_for_vlt_background` in
`clean-helpers.sh`). The waits are untimed; in real use, the next install
rarely starts that soon. No other tool was seen leaving processes behind.

## How each tool is installed and run

Each package manager is installed the way its maintainers recommend
(`suite/scripts/setup.sh`), and every timed command runs that tool directly,
the way a user would, with no extra launcher in front of it.

| Tool                | Installed with                                                                                                              | Timed command runs                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| npm, vlt, bun, deno | `npm install -g <tool>@latest`                                                                                              | `<tool>` on `PATH`                                                                 |
| pnpm                | `npm install -g --allow-scripts=pnpm pnpm@latest` ([pnpm.io](https://pnpm.io/installation))                                 | `pnpm` on `PATH`, pnpm's native binary                                             |
| yarn (1)            | `npm install --global yarn@1` ([classic.yarnpkg.com](https://classic.yarnpkg.com/en/docs/install))                          | that `yarn`, by full path                                                          |
| berry (Yarn 4)      | `npm install -g corepack` ([yarnpkg.com](https://yarnpkg.com/getting-started/install))                                      | Corepack's `yarn` shim, by full path, with `packageManager: yarn@<version>` pinned |
| zpm (Yarn 6)        | Yarn Switch (`curl -sS https://repo.yarnpkg.com/install \| bash`, [v6.yarnpkg.com](https://v6.yarnpkg.com/getting-started)) | Yarn Switch's `yarn`, by full path, with `packageManager: yarn@<version>` pinned   |

Yarn 1, Yarn 4 and Yarn 6 all install a command called `yarn`, so yarn 1 and
Corepack get their own npm prefixes (`suite/scripts/pm-bins.sh`) and all three
are called by full path. npm 12 blocks install scripts by default; without
`--allow-scripts=pnpm`, pnpm's postinstall doesn't put its native binary in
place and `pnpm` runs through a JavaScript launcher instead. The berry version
is resolved once per job (`yarn@latest`) and pinned in `package.json` for each
berry run, as `yarn set version` would; `clean-helpers.sh` removes the pin
before the next tool runs. In `ci+setup`, the "setup" part of each timed
command is the same install (into a fresh prefix with an empty npm cache, so
it downloads every time); for berry that is installing Corepack plus
Corepack's download of Yarn.

Until [#207](https://github.com/vltpkg/benchmarks/issues/207), pnpm, yarn and
berry ran through `corepack pnpm@latest`, `corepack yarn@1` and
`corepack yarn@latest`. That put a Node.js process (Corepack) in front of every
timed command, and for the `@latest` forms a registry lookup too: about half a
second per pnpm command, less for yarn. pnpm's (and to a lesser degree yarn's)
results drop at that point because that overhead is gone, not because pnpm
got faster.

## Normalization: why per-package time matters

Package managers disagree about what a dependency graph contains. Comparing
wall-clock install time alone rewards a tool that installs fewer packages.

So the suite counts packages actually installed, per tool, per fixture, per
variation, and the site reports both total time and time per package:

- Manager A installs **1,000** packages in **10s** → ~**10ms** per package
- Manager B installs **10** packages in **1s** → ~**100ms** per package

B is faster on the clock and ten times slower per unit of work. Both numbers
are published; neither alone is the answer.

## Process counts

After the timed runs, each tool's command runs once more, untimed, under
`strace -f -e trace=execve,execveat`, from the same starting state as its timed
runs (`suite/scripts/process-count.sh`). The count is the number of processes
that ran a program: each process with at least one successful `execve` counts
once.

- Failed `execve` calls don't count. They are lookups along `PATH`, so they
  depend on the machine, not the tool.
- An interpreter doesn't count on its own. A `#!/usr/bin/env node` script runs
  `env` and then `node` in the same process, so npm with no child processes
  counts **1**.
- The `bash -c` the harness wraps the command in doesn't count.
- A launcher counts. yarn, berry and pnpm run through `corepack`, so pnpm's
  **3** is `corepack`, `pnpm-native` and `node --version`.
- Detached processes count, so a count can depend on state. vlt counts its
  background cache unpacking only when there is something to unpack: **2** in
  `clean`, **1** in `ci` on a warm cache. Its update-check and revalidate
  processes may add to that, depending on timing.
- If the command, or the install that sets up its starting state, exits
  non-zero or runs past `BENCH_TIMEOUT`, nothing is recorded for that tool.

Earlier counts (issue #209) counted every `execve` line, including the
wrapper, failed lookups and the interpreter, and `ci` counted most tools
against npm's lockfile. Until issue #214, the lockfile, `node_modules` and
cache variations counted each tool from what earlier tools left, not its own
lockfile, `node_modules` or cache, and upm, which refuses more than one
lockfile, had no count in the lockfile variations. Until November 2026,
cleaning `node_modules` left the workspaces' `node_modules` behind on
`babylon`, so in the lockfile and cache variations every tool but the first
started from what earlier tools had put there, and npm's `lockfile` count was
missing. Don't compare them with later counts.

## Variations

| Variation                     | Starting state / what it measures                                |
| ----------------------------- | ---------------------------------------------------------------- |
| `clean`                       | nothing cached, no lockfile, no `node_modules` — worst case      |
| `cache`                       | warm cache only                                                  |
| `lockfile`                    | lockfile present, no cache, no `node_modules`                    |
| `node_modules`                | `node_modules` present                                           |
| `cache+lockfile`              | cache and lockfile                                               |
| `cache+node_modules`          | cache and `node_modules`                                         |
| `lockfile+node_modules`       | lockfile and `node_modules`                                      |
| `cache+lockfile+node_modules` | everything warm — best case                                      |
| `ci`                          | the tool's CI-oriented install (`npm ci` and equivalents)        |
| `add-singleton`               | add one uncached zero-dependency package to an installed project |
| `remove-singleton`            | remove that package from an installed project                    |
| `add-overlap`                 | add one uncached package whose deps overlap the existing graph   |
| `remove-overlap`              | remove that package from an installed project                    |
| `build`                       | a project build after install (`next` only, see below)           |
| `build-cache`                 | a project build with a warm build cache (same)                   |
| `run`                         | script-execution overhead (`run` fixture only)                   |
| `registry-clean`              | `clean`, comparing **registries** instead of managers            |
| `registry-lockfile`           | `lockfile`, comparing **registries**                             |

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

## Add / remove variations

`add-singleton`, `remove-singleton`, `add-overlap` and `remove-overlap` time a
single dependency change in a project that is already installed, using each
manager's own command (`npm install <spec>` / `npm uninstall <name>`,
`yarn add` / `yarn remove`, `pnpm add` / `pnpm remove`, `vlt install <spec>` /
`vlt uninstall <name>`, `bun add` / `bun remove`, `deno add npm:<spec>` /
`deno remove npm:<name>`, `aube add` / `aube remove`, `upm add` / `upm remove`;
`-W`/`-w` at workspace roots). Shared logic lives in
`suite/scripts/variations/add-remove.sh`.

**Starting state.** Before a manager's first run its baseline is built from
scratch: project files cleaned, a regular install (lockfile, `node_modules`,
warm cache), and for `remove-*` the package added by that same manager. The
whole fixture directory is then snapshotted, and every run (warmup or timed)
starts from `rsync --delete` of that snapshot
(`suite/scripts/add-remove-state.sh`), so each run sees byte-identical
`package.json`, lockfile and `node_modules`. For `add-*`, the manager's global
cache directories are snapshotted with the project and restored before every
run too, so the cache holds the project's packages but never the package
being added: each timed add fetches a net-new package, as adding a
dependency you have never installed would. vlt's detached cache unpacking is
waited out before each snapshot and restore (untimed), so one run's
background work never overlaps the next. Caches are also cleaned
(`clean_all`) before and after each manager's set of runs, as in every
variation. "Remove" means removing the package from the project it was added
to; whether it is cached doesn't matter there.

**Packages** (versions pinned):

| Fixture        | singleton           | overlap                        | already in graph                                     |
| -------------- | ------------------- | ------------------------------ | ---------------------------------------------------- |
| all            | `@vltpkg/xdg@1.8.0` | —                              | zero dependencies of any kind                        |
| `next`         |                     | `log-symbols@4.1.0`            | 6 of 8 (chalk@4 and its deps)                        |
| `astro`, `vue` |                     | `@rollup/plugin-replace@6.0.3` | 6 of 7 (pluginutils, magic-string, …, peer rollup)   |
| `svelte`       |                     | `@rollup/plugin-replace@6.0.3` | 4 of 7 (magic-string, picomatch, peer rollup)        |
| `large`        |                     | `react-redux@9.2.0`            | react, redux, use-sync-external-store                |
| `babylon`      |                     | `del@9.0.1`                    | 18 of 28, several at other majors (nested placement) |

None of the packages is itself in its fixture's graph. Package counts are taken
after the add/remove, so `add-*` is baseline + new packages.

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
/summary/{date}.json                               one date's results, counts and versions
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

### `summary/{date}.json`

One file per date, so a trend over many runs costs one fetch a run, not one
per file. Every value is lifted verbatim from that date's files; nothing is
derived. Written by `apps/data` build-manifest on each deploy, for every date.

| Key              | Holds                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| `{variation}`    | `{fixture}` to that benchmark file's results: `command`, `mean`, `stddev`, `exit_codes` |
| `#packageCounts` | `{variation}` to `{fixture}` to that package-count file, as published                   |
| `#versions`      | that date's `versions.json`                                                             |

Results keep `exit_codes`, so a failed run is still a failed run. The `#` keys
were added in 2026-11 and are each optional: a summary written before then has
none, and a date that published no count files or no `versions.json` has no
such key. Absent means "read the file", never zero. No variation name starts
with `#`.
