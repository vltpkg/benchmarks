# Fixtures

A fixture is a real project the suite installs and measures. There are seven.
Each page below says what the project is, what installing it exercises, and
which variations apply to it.

| Fixture                 | Shape                     | Dependency load               | Pages                                                        |
| ----------------------- | ------------------------- | ----------------------------- | ------------------------------------------------------------ |
| [`next`](NEXT.md)       | Next.js starter           | 3 deps + 8 devDeps            | the only fixture scheduled for `build` / `build-cache` today |
| [`astro`](ASTRO.md)     | Astro starter             | 1 dep                         | smallest install                                             |
| [`svelte`](SVELTE.md)   | SvelteKit demo            | 9 devDeps                     | dev-dependency-dominated                                     |
| [`vue`](VUE.md)         | Vue starter               | 3 deps + 22 devDeps           | heaviest of the framework starters                           |
| [`large`](LARGE.md)     | dependency pile, no app   | 109 deps + 1 devDep           | resolution and install throughput                            |
| [`babylon`](BABYLON.md) | Babylon.js monorepo       | 45 devDeps over 86 workspaces | workspace resolution at scale                                |
| [`run`](RUN.md)         | empty package, one script | 0 deps + 2 devDeps            | process spawn only                                           |

Every fixture directory carries its own `vlt.json`, which points installs at
the benchmark registry mirror and makes the fixture its own vlt project root, so
an install never resolves the surrounding repository instead.

Six fixtures take the install variations. `run` takes only the `run` variation —
`run-run` is the only `*-run.json` pair anywhere in the archive. `next` is the
only fixture currently scheduled for `build` and `build-cache`, but 10 dates
between 2026-05-09 and 2026-08-03 ran those for all six install fixtures, so the
archive holds `astro-build.json` and friends. Which pairs
actually exist for a given day is discoverable from the data — see
[`../METHODOLOGY.md`](../METHODOLOGY.md#discover-never-enumerate).
