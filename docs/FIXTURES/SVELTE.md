# `svelte`

A [SvelteKit](https://kit.svelte.dev) demo project.

- Directory: `suite/fixtures/svelte`
- Manifest name: `demo`
- Dependencies: 0 runtime, 9 development
- Notable files: `svelte.config.js`, `vite.config.js`, `jsconfig.json`, `src/`

## What it exercises

An install that is **entirely devDependencies** — no runtime dependencies at
all. Useful for two reasons:

- It checks that a tool's `--production`-style defaults and dependency-type
  handling do not accidentally change what gets installed.
- SvelteKit's toolchain includes a `postinstall`-style sync step in normal use,
  so this fixture is where lifecycle-script handling shows up.

## Variations

All install variations. No `build`, `build-cache` or `run`.
