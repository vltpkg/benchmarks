#!/bin/bash

# Exit on error
set -e

# WARNING
echo "WARNING: This script removes all installed packages, cache files & uncommitted git history. Changes have been stashed if this was unintended."

# Navigate to the fixture directory
cd ./fixtures/run

# Run the benchmark suite
echo "Running benchmark suite..."
hyperfine --export-json=../../results/run.json \
    --warmup 3 \
    --runs 10 \
    --timeout 300 \
    --max-runs 15 \
    -i \
    --prepare 'bash ../../scripts/clean.sh; npm install' \
    --ignore-failure \
    -n 'npm' 'npm run test || true' \
    -n 'yarn' 'corepack yarn@1 run test || true' \
    -n 'berry' 'corepack yarn@latest run test || true' \
    -n 'pnpm' 'corepack pnpm@latest run test || true' \
    -n 'vlt' 'vlt run test || true' \
    -n 'bun' 'bun run test || true' \
    -n 'deno' 'deno run test || true' \
    -n 'nx' 'nx run test || true' \
    -n 'turbo' 'turbo run test --dangerously-disable-package-manager-check --cache-dir=.cache --no-cache || true' \
    -n 'node' 'node --run test || true'

echo "Benchmark suite completed successfully!"
