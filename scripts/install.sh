#!/bin/bash

# WARNING
echo "WARNING: This script removes all installed packages, cache files & uncommitted git history. Changes have been stashed if this was unintended."

# Navigate to the fixture directory
cd ./fixtures/$1

# Create the results directory
mkdir -p ../../results/$1

# Run the benchmark suite
hyperfine --export-json=../../results/$1/benchmarks.json --warmup 3 --runs 10 -i --prepare 'bash ../../scripts/clean.sh' \
  -n 'npm' 'bash ../../scripts/install/npm.sh' \
  -n 'yarn' 'bash ../../scripts/install/yarn.sh' \
  -n 'berry' 'bash ../../scripts/install/berry.sh' \
  -n 'pnpm' 'bash ../../scripts/install/pnpm.sh' \
  -n 'vlt' 'bash ../../scripts/install/vlt.sh' \
  -n 'blt' 'bash ../../scripts/install/blt.sh' \
  -n 'bun' 'bash ../../scripts/install/bun.sh' \
  -n 'deno' 'bash ../../scripts/install/deno.sh'

# Count the number of packages installed

# npm
bash ../../scripts/clean.sh
bash ../../scripts/install/npm.sh
NPM_COUNT=$(bash ../../scripts/package-count.sh)

# yarn
bash ../../scripts/clean.sh
bash ../../scripts/install/yarn.sh
YARN_COUNT=$(bash ../../scripts/package-count.sh)

# yarn berry
bash ../../scripts/clean.sh
bash ../../scripts/install/berry.sh
BERRY_COUNT=$(bash ../../scripts/package-count.sh)

# pnpm
bash ../../scripts/clean.sh
bash ../../scripts/install/pnpm.sh
PNPM_COUNT=$(bash ../../scripts/package-count.sh)

# vlt
bash ../../scripts/clean.sh
bash ../../scripts/install/vlt.sh
VLT_COUNT=$(bash ../../scripts/package-count.sh)

# blt
bash ../../scripts/clean.sh
bash ../../scripts/install/blt.sh
BLT_COUNT=$(bash ../../scripts/package-count.sh)

# bun
bash ../../scripts/clean.sh
bash ../../scripts/install/bun.sh
BUN_COUNT=$(bash ../../scripts/package-count.sh)

# deno
bash ../../scripts/clean.sh
bash ../../scripts/install/deno.sh
DENO_COUNT=$(bash ../../scripts/package-count.sh)

# Write the results to a file
echo "{
  \"npm\": $NPM_COUNT,
  \"yarn\": $YARN_COUNT,
  \"berry\": $BERRY_COUNT,
  \"pnpm\": $PNPM_COUNT,
  \"vlt\": $VLT_COUNT,
  \"blt\": $BLT_COUNT,
  \"bun\": $BUN_COUNT,
  \"deno\": $DENO_COUNT
}" > ../../results/$1/package-count.json