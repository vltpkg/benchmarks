# Exit on error
set -Eeuxo pipefail

# Load registry common variables
source "$1/registry/common.sh"

# Prepare command base for each run: clean cache, node_modules, pm files, but keep lockfile
BENCH_PREPARE_BASE="sleep 1; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all_cache clean_node_modules clean_package_manager_files clean_npmrc"

# Run the benchmark suite
# When running a lockfile benchmark, we keep the lockfile between runs
# but clean cache, node_modules, and package manager files.
echo "Hyperfine version: $(hyperfine --version)"
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --setup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all clean_npmrc" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all clean_npmrc" \
  ${BENCH_INCLUDE_REG_NPM:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_REG_VLT:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT_REG"} \
  ${BENCH_INCLUDE_REG_VLT_AUTH:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_VLT_AUTH:+--command-name="vlt-auth" "$BENCH_COMMAND_VLT_AUTH"} \
  ${BENCH_INCLUDE_REG_AWS:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_AWS:+--command-name="aws" "$BENCH_COMMAND_AWS"}
