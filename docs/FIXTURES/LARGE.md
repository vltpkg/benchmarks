# `large`

Not an application. A `package.json` with **109 direct dependencies** and
nothing else.

- Directory: `suite/fixtures/large`
- Manifest name: `alotta-modules`
- Dependencies: 109 runtime, 1 development
- Notable files: `package.json`, `vlt.json` — that is the whole fixture
- No scripts at all

## What it exercises

Install throughput and resolver behaviour at breadth, with no application code
to confuse the picture. The dependency list is deliberately an old-style
front-end toolchain pile (Babel, ESLint, Less, Webpack and friends), which
produces a wide, deeply shared transitive graph with plenty of duplicate
candidates to deduplicate.

This is the fixture where differences in **how many packages a tool decides to
install** are largest — which is exactly why the site reports per-package time
alongside total time. See
[`../METHODOLOGY.md`](../METHODOLOGY.md#normalization-why-per-package-time-matters).

## Variations

All install variations. No `build`, `build-cache` or `run`.
