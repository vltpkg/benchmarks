# `next`

A stock [Next.js](https://nextjs.org) App Router starter — the shape most
readers will recognise, and the default fixture when you run the suite with no
arguments.

- Directory: `suite/fixtures/next`
- Manifest name: `nextjs`, private
- Dependencies: 3 runtime, 8 development
- Notable files: `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`,
  `tsconfig.json`, `app/`

## What it exercises

A realistic small application install: a framework, React, and a TypeScript and
Tailwind toolchain. Small enough that per-package overhead and client startup
cost are visible rather than drowned out by download volume, which is why it is
the default.

## Variations

All install variations, plus the two it is the only fixture scheduled for
**today**:

- **`build`** — a production `next build` after install. Measures the build, not
  the install.
- **`build-cache`** — the same build with a warm Next build cache.

On 10 dates between 2026-05-09 and 2026-08-03 the suite ran `build` and
`build-cache` for all six install fixtures, so `astro-build.json` and its
siblings exist in the published archive. Read the pairs for a date from that
date's manifest rather than from this page.

Because `build` and `build-cache` measure a script rather than an install, they
publish **neither** a package-count nor a process-count file. That is the
contract, not missing data; see
[`../METHODOLOGY.md`](../METHODOLOGY.md#a-missing-file-is-an-answer).

## Reading its numbers

`next-clean` is the headline worst case: cold cache, no lockfile, no
`node_modules`. `next-cache+lockfile+node_modules` is the best case and is
usually dominated by how fast a tool can decide it has nothing to do.
