# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# Run the benchmark suite
# When running a cache benchmark, we want to clean up only the node_modules
# directory and the lockfiles between each run.
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --setup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  --prepare="sleep 1; bash $BENCH_SCRIPTS/clean-helpers.sh clean_lockfiles clean_node_modules clean_package_manager_files" \
  --conclude="sleep 1; bash $BENCH_SCRIPTS/package-count.sh $BENCH_OUTPUT_FOLDER; bash $BENCH_SCRIPTS/clean-helpers.sh clean_lockfiles clean_node_modules clean_package_manager_files clean_package_manager_field clean_build_files" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  ${BENCH_INCLUDE_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_YARN:+--command-name="yarn" "$BENCH_COMMAND_YARN"} \
  ${BENCH_INCLUDE_BERRY:+--command-name="berry" "$BENCH_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_PNPM:+--command-name="pnpm" "$BENCH_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"}

collect_package_count
