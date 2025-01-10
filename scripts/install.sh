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
  -n 'bun' 'bash ../../scripts/install/bun.sh' \
  -n 'deno' 'bash ../../scripts/install/deno.sh'

# Count the number of packages installed

# npm
bash ../../scripts/clean.sh
bash ../../scripts/install/npm.sh
bash ../../scripts/package-count.sh >> "../../results/$1/npm" 

# yarn
bash ../../scripts/clean.sh
bash ../../scripts/install/yarn.sh
bash ../../scripts/package-count.sh >> "../../results/$1/yarn" 

# yarn berry
bash ../../scripts/clean.sh
bash ../../scripts/install/berry.sh
bash ../../scripts/package-count.sh >> "../../results/$1/berry"

# pnpm
bash ../../scripts/clean.sh
bash ../../scripts/install/pnpm.sh
bash ../../scripts/package-count.sh >> "../../results/$1/pnpm"

# vlt
bash ../../scripts/clean.sh
bash ../../scripts/install/vlt.sh
bash ../../scripts/package-count.sh >> "../../results/$1/vlt"

# bun
bash ../../scripts/clean.sh
bash ../../scripts/install/bun.sh
bash ../../scripts/package-count.sh >> "../../results/$1/bun"

# deno
bash ../../scripts/clean.sh
bash ../../scripts/install/deno.sh
bash ../../scripts/package-count.sh >> "../../results/$1/deno"
