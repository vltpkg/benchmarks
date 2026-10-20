# `babylon`

A checkout of the [Babylon.js](https://www.babylonjs.com) monorepo — the largest
and slowest fixture in the suite.

- Directory: `suite/fixtures/babylon`
- Manifest name: `@babylonjs/root`, private
- Dependencies: 0 runtime, 45 development at the root
- **86 workspace packages** under `packages/`
- Notable files: `nx.json`, `lerna.json`, `pnpm-workspace.yaml`, six
  `tsconfig.*.json`, and a `vlt.json` that declares
  `"workspaces": ["packages/**/*"]`

## What it exercises

**Workspace resolution at scale.** Every other fixture is a single package; this
one is 86 of them with internal cross-dependencies, which is a different problem
from installing a wide flat graph. It is the fixture that catches a tool handling
`workspace:` protocol specifiers, hoisting, or link topology badly.

It is also the only fixture whose own `vlt.json` declares workspaces.

## Variations

All install variations. No `build`, `build-cache` or `run`.

It is the main reason a full suite run takes roughly 40 minutes.

## A note on reading its numbers

Absolute times here are large enough that cold-cache network variance matters
more than in the small fixtures. Prefer the median and the standard deviation
over the mean when comparing tools on `babylon`, and check `exit_codes` — a tool
that partially fails on a monorepo this size can still post a plausible time,
because the suite runs hyperfine with `--ignore-failure`.
