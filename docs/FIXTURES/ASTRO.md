# `astro`

The [Astro](https://astro.build) minimal starter. The smallest install in the
suite.

- Directory: `suite/fixtures/astro`
- Manifest name: `my-astro-project`
- Dependencies: 1 runtime, 0 development
- Notable files: `astro.config.mjs`, `src/`, `tsconfig.json`

## What it exercises

One declared dependency that pulls a substantial transitive tree. This makes it
the clearest test of **resolution** cost as distinct from download volume: the
manifest is trivial, so nearly all the work is graph work.

It is also the most sensitive fixture to per-package overhead, because there is
almost no fixed cost to hide behind.

## Variations

All install variations. No `build`, `build-cache` or `run`.

Both `registry-*` variations apply, so `astro` is a good place to compare
registries without a large fixture's download time dominating.
