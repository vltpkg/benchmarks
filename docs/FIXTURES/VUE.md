# `vue`

A [Vue](https://vuejs.org) `create-vue` starter with the full optional
toolchain selected.

- Directory: `suite/fixtures/vue`
- Manifest name: `vue-project`, private
- Dependencies: 3 runtime, 22 development
- Notable files: `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`,
  four `tsconfig.*.json`, `eslint.config.js`, `e2e/`

## What it exercises

The heaviest of the four framework starters, and the most realistic picture of a
modern application's _development_ dependency load: Vite, Vitest, Playwright,
ESLint and `vue-tsc` on top of the framework itself.

Playwright is the interesting part. It is a large package whose install commonly
triggers post-install work, so this fixture stresses lifecycle handling and
large-artifact download more than the other starters.

## Variations

All install variations. No `build`, `build-cache` or `run`.
