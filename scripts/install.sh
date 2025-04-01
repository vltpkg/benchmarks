#!/bin/bash

# Exit on error
set -e

# Check if project name is provided
if [ -z "$1" ]; then
    echo "Error: Project name not provided"
    echo "Usage: $0 <project-name>"
    exit 1
fi

# WARNING
echo "WARNING: This script removes all installed packages, cache files & uncommitted git history. Changes have been stashed if this was unintended."

# Navigate to the fixture directory
cd "./fixtures/$1"

# Create the results directory
mkdir -p "../../results/$1"

# Run the benchmark suite
echo "Running installation benchmark suite for $1..."
hyperfine --export-json="../../results/$1/benchmarks.json" \
    --warmup 3 \
    --runs 10 \
    --max-runs 15 \
    -i \
    --prepare 'bash ../../scripts/clean.sh' \
    --ignore-failure \
    -n 'npm' 'bash ../../scripts/install/npm.sh || true' \
    -n 'yarn' 'bash ../../scripts/install/yarn.sh || true' \
    -n 'berry' 'bash ../../scripts/install/berry.sh || true' \
    -n 'pnpm' 'bash ../../scripts/install/pnpm.sh || true' \
    -n 'vlt' 'bash ../../scripts/install/vlt.sh || true' \
    -n 'bun' 'bash ../../scripts/install/bun.sh || true' \
    -n 'deno' 'bash ../../scripts/install/deno.sh || true'

# Count the number of packages installed
echo "Counting installed packages..."

# Function to count packages for a specific package manager
count_packages() {
    local pm=$1
    echo "Counting packages for $pm..."
    bash ../../scripts/clean.sh
    bash "../../scripts/install/$pm.sh" || true
    bash ../../scripts/package-count.sh || echo "0"
}

# Count packages for each package manager
NPM_COUNT=$(count_packages "npm")
YARN_COUNT=$(count_packages "yarn")
BERRY_COUNT=$(count_packages "berry")
PNPM_COUNT=$(count_packages "pnpm")
VLT_COUNT=$(count_packages "vlt")
BUN_COUNT=$(count_packages "bun")
DENO_COUNT=$(count_packages "deno")

# Write the results to a file
echo "{
  \"npm\": $NPM_COUNT,
  \"yarn\": $YARN_COUNT,
  \"berry\": $BERRY_COUNT,
  \"pnpm\": $PNPM_COUNT,
  \"vlt\": $VLT_COUNT,
  \"bun\": $BUN_COUNT,
  \"deno\": $DENO_COUNT
}" > "../../results/$1/package-count.json"

echo "Installation benchmark suite completed successfully!"