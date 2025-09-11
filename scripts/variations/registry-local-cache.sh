#!/bin/bash
# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# Update command strings to use registry configuration
update_commands_for_registry() {
  BENCH_COMMAND_NPM="npm install --registry=$BENCH_REGISTRY_URL --no-audit --no-fund --silent >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
  BENCH_COMMAND_YARN="corepack yarn@1 install --registry $BENCH_REGISTRY_URL --silent > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
  BENCH_COMMAND_BERRY="echo \"$BENCH_COMMAND_BERRY_PRE\" > .yarnrc.yml; echo \"npmRegistryServer: $BENCH_REGISTRY_URL\" >> .yarnrc.yml; corepack yarn@latest install > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
  BENCH_COMMAND_PNPM="corepack pnpm@latest install --registry=$BENCH_REGISTRY_URL --silent > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
  BENCH_COMMAND_VLT="vlt install --registry=$BENCH_REGISTRY_URL --view=silent > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
  # Bun and Deno don't support custom registries in the same way
  BENCH_COMMAND_BUN=""
  BENCH_COMMAND_DENO=""
  BENCH_INCLUDE_BUN=""
  BENCH_INCLUDE_DENO=""
}

# Pre-warm registry function
warm_registry() {
  local registry_type=$1
  
  echo "Pre-warming $registry_type registry..."
  
  # Save current directory
  local current_dir=$(pwd)
  
  # Use npm to install packages and warm the cache
  npm install --registry="$BENCH_REGISTRY_URL" --silent > "$BENCH_OUTPUT_FOLDER/warm-$registry_type.log" 2>&1 || true
  
  # Clean up after warming
  bash "$BENCH_SCRIPTS/clean-helpers.sh" clean_node_modules clean_lockfiles
  
  cd "$current_dir"
}

# Function to run benchmarks for a specific registry
run_registry_benchmark() {
  local registry_type=$1
  
  # Stop any existing registries
  bash "$BENCH_SCRIPTS/registry-helpers.sh" stop_all
  
  # Clean the registry cache first
  bash "$BENCH_SCRIPTS/registry-helpers.sh" clean "$registry_type"
  
  # Start the registry
  BENCH_REGISTRY_URL=$(bash "$BENCH_SCRIPTS/registry-helpers.sh" start "$registry_type" "$BENCH_OUTPUT_FOLDER")
  export BENCH_REGISTRY_URL
  
  echo "Registry started at: $BENCH_REGISTRY_URL"
  
  # Update commands with registry URL
  update_commands_for_registry
  
  # Pre-warm the registry
  warm_registry "$registry_type"
  
  # Run the benchmark suite
  echo "Running benchmarks with $registry_type registry (pre-warmed)..."
  hyperfine --ignore-failure \
    --time-unit=millisecond \
    --export-json="$BENCH_OUTPUT_FOLDER/benchmarks-$registry_type.json" \
    --warmup="$BENCH_WARMUP" \
    --runs="$BENCH_RUNS" \
    --prepare="sleep 1; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
    --conclude="sleep 1; bash $BENCH_SCRIPTS/package-count.sh $BENCH_OUTPUT_FOLDER; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
    --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
    ${BENCH_INCLUDE_NPM:+--command-name="npm-$registry_type" "$BENCH_COMMAND_NPM"} \
    ${BENCH_INCLUDE_YARN:+--command-name="yarn-$registry_type" "$BENCH_COMMAND_YARN"} \
    ${BENCH_INCLUDE_BERRY:+--command-name="berry-$registry_type" "$BENCH_COMMAND_BERRY"} \
    ${BENCH_INCLUDE_PNPM:+--command-name="pnpm-$registry_type" "$BENCH_COMMAND_PNPM"} \
    ${BENCH_INCLUDE_VLT:+--command-name="vlt-$registry_type" "$BENCH_COMMAND_VLT"}
  
  # Stop the registry
  bash "$BENCH_SCRIPTS/registry-helpers.sh" stop "$registry_type"
}

# Run benchmarks for both registries
run_registry_benchmark "vsr"
run_registry_benchmark "verdaccio"

# Merge results
echo "Merging benchmark results..."
jq -s '.[0] * {results: (.[0].results + .[1].results)}' \
  "$BENCH_OUTPUT_FOLDER/benchmarks-vsr.json" \
  "$BENCH_OUTPUT_FOLDER/benchmarks-verdaccio.json" \
  > "$BENCH_OUTPUT_FOLDER/benchmarks.json"

collect_package_count