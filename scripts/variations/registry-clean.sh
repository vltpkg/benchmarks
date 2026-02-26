# Exit on error
set -Eeuxo pipefail

# Load registry common variables
source "$1/registry/common.sh"

# Prepare command base for each run: clean everything and remove .npmrc
BENCH_PREPARE_BASE="sleep 1; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all; rm -f .npmrc"

# Run the benchmark suite
# When running a clean benchmark, we want to clean up all the things in
# between each run using the clean-helper.sh script.
echo "Hyperfine version: $(hyperfine --version)"
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all; rm -f .npmrc" \
  ${BENCH_INCLUDE_REG_NPM:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_REG_VLT:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT_REG"} \
  ${BENCH_INCLUDE_REG_VLT_AUTH:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_VLT_AUTH:+--command-name="vlt-auth" "$BENCH_COMMAND_VLT_AUTH"} \
  ${BENCH_INCLUDE_REG_CODEARTIFACT:+--prepare="$BENCH_PREPARE_BASE"} \
  ${BENCH_INCLUDE_REG_CODEARTIFACT:+--command-name="codeartifact" "$BENCH_COMMAND_CODEARTIFACT"}
