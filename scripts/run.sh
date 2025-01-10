#!/bin/bash

# WARNING
echo "WARNING: This script removes all installed packages, cache files & uncommitted git history."

# Navigate to the fixture directory
cd ./fixtures/$1

# Run the benchmark suite
hyperfine --export-json=../../results/run.json --warmup 3 --runs 10 -i --prepare 'bash ../../scripts/clean.sh' \
  -n 'npm' 'npm run test' \
  -n 'yarn' 'corepack yarn@1 run test' \
  -n 'berry' 'corepack yarn@latest run test' \
  -n 'pnpm' 'corepack pnpm@latest run test' \
  -n 'vlt' 'vlt run test' \
  -n 'bun' 'bun run test' \
  -n 'deno' 'deno run test'
  