# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# Keep a reference to the original install commands for each package manager
# as the HYPERFINE_ITERATION variable is not available in the run command,
# we are replacing it with a "run" placeholder but that means we're only going
# to preserve a single output file for the install commands.
# This may be replaced once the prepare command suports the iteration magic value
# ref: https://github.com/sharkdp/hyperfine/issues/781
BENCH_INSTALL_COMMAND_NPM="${BENCH_COMMAND_NPM//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_YARN="${BENCH_COMMAND_YARN//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_BERRY="${BENCH_COMMAND_BERRY//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_PNPM="${BENCH_COMMAND_PNPM//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_VLT="${BENCH_COMMAND_VLT//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_BUN="${BENCH_COMMAND_BUN//\$\{HYPERFINE_ITERATION\}/run}"
BENCH_INSTALL_COMMAND_DENO="${BENCH_COMMAND_DENO//\$\{HYPERFINE_ITERATION\}/run}"

# Run defines its own command scripts to actually run a test
# script in the fixture directory instead of installing packages.
BENCH_COMMAND_NPM="npm run test > $BENCH_OUTPUT_FOLDER/npm-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="corepack yarn@1 run test > $BENCH_OUTPUT_FOLDER/yarn-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="corepack yarn@latest run test > $BENCH_OUTPUT_FOLDER/berry-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="corepack pnpm@latest run test > $BENCH_OUTPUT_FOLDER/pnpm-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="vlt run test --view=human > $BENCH_OUTPUT_FOLDER/vlt-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="bun run test > $BENCH_OUTPUT_FOLDER/bun-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="deno run test > $BENCH_OUTPUT_FOLDER/deno-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_NX="nx run test > $BENCH_OUTPUT_FOLDER/nx-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_TURBO="turbo run test --dangerously-disable-package-manager-check --cache-dir=.cache --no-cache > $BENCH_OUTPUT_FOLDER/turbo-run-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_NODE="node --run test > $BENCH_OUTPUT_FOLDER/node-run-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Run the benchmark run-script benchmarks
# The install step is defined as a "prepare" option so that time spent
# on the install is not accounted for in the benchmark results.
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  ${BENCH_INCLUDE_NPM:+--prepare="$BENCH_INSTALL_COMMAND_NPM || true"} \
  ${BENCH_INCLUDE_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_YARN:+--prepare="$BENCH_INSTALL_COMMAND_YARN"} \
  ${BENCH_INCLUDE_YARN:+--command-name="yarn" "$BENCH_COMMAND_YARN"} \
  ${BENCH_INCLUDE_BERRY:+--prepare="$BENCH_INSTALL_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_BERRY:+--command-name="berry" "$BENCH_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_PNPM:+--prepare="$BENCH_INSTALL_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_PNPM:+--command-name="pnpm" "$BENCH_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_VLT:+--prepare="$BENCH_INSTALL_COMMAND_VLT"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--prepare="$BENCH_INSTALL_COMMAND_BUN"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--prepare="$BENCH_INSTALL_COMMAND_DENO"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"} \
  ${BENCH_INCLUDE_NX:+--prepare="$BENCH_INSTALL_COMMAND_NPM || true"} \
  ${BENCH_INCLUDE_NX:+--command-name="nx" "$BENCH_COMMAND_NX"} \
  ${BENCH_INCLUDE_TURBO:+--prepare="$BENCH_INSTALL_COMMAND_NPM || true"} \
  ${BENCH_INCLUDE_TURBO:+--command-name="turbo" "$BENCH_COMMAND_TURBO"} \
  ${BENCH_INCLUDE_NODE:+--prepare="$BENCH_INSTALL_COMMAND_NPM || true"} \
  ${BENCH_INCLUDE_NODE:+--command-name="node" "$BENCH_COMMAND_NODE"}