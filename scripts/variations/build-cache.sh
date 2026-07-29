# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# Build-cache variation: install deps + run build once (warm the .next/ cache),
# then time `<pm> run build` again (with .next/ cache present).
# The install + initial build are in the "prepare" step so only the cached
# rebuild is measured.

# Keep a reference to the original install commands for each package manager.
BENCH_INSTALL_COMMAND_NPM="${BENCH_COMMAND_NPM//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_YARN="${BENCH_COMMAND_YARN//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_BERRY="${BENCH_COMMAND_BERRY//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_ZPM="${BENCH_COMMAND_ZPM//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_PNPM="${BENCH_COMMAND_PNPM//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_PACQUET="${BENCH_COMMAND_PACQUET//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_VLT="${BENCH_COMMAND_VLT//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_BUN="${BENCH_COMMAND_BUN//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_DENO="${BENCH_COMMAND_DENO//\$\{HYPERFINE_ITERATION\}/build-cache}"
BENCH_INSTALL_COMMAND_AUBE="${BENCH_COMMAND_AUBE//\$\{HYPERFINE_ITERATION\}/build-cache}"

BENCH_INSTALL_PREPARE_NPM="$(prepend_setup "$BENCH_INSTALL_COMMAND_NPM" "$BENCH_SETUP_NPM")"
BENCH_INSTALL_PREPARE_YARN="$(prepend_setup "$BENCH_INSTALL_COMMAND_YARN" "$BENCH_SETUP_YARN")"
BENCH_INSTALL_PREPARE_BERRY="$(prepend_setup "$BENCH_INSTALL_COMMAND_BERRY" "$BENCH_SETUP_BERRY")"
BENCH_INSTALL_PREPARE_ZPM="$(prepend_setup "$BENCH_INSTALL_COMMAND_ZPM" "$BENCH_SETUP_ZPM")"
BENCH_INSTALL_PREPARE_PNPM="$(prepend_setup "$BENCH_INSTALL_COMMAND_PNPM" "$BENCH_SETUP_PNPM")"
BENCH_INSTALL_PREPARE_PACQUET="$(prepend_setup "$BENCH_INSTALL_COMMAND_PACQUET" "$BENCH_SETUP_PACQUET")"
BENCH_INSTALL_PREPARE_VLT="$(prepend_setup "$BENCH_INSTALL_COMMAND_VLT" "$BENCH_SETUP_VLT")"
BENCH_INSTALL_PREPARE_BUN="$(prepend_setup "$BENCH_INSTALL_COMMAND_BUN" "$BENCH_SETUP_BUN")"
BENCH_INSTALL_PREPARE_DENO="$(prepend_setup "$BENCH_INSTALL_COMMAND_DENO" "$BENCH_SETUP_DENO")"
BENCH_INSTALL_PREPARE_AUBE="$(prepend_setup "$BENCH_INSTALL_COMMAND_AUBE" "$BENCH_SETUP_AUBE")"

# Warm build commands (run once in prepare to populate the .next/ cache).
BENCH_WARM_BUILD_NPM="timeout $BENCH_TIMEOUT npm run build > $BENCH_OUTPUT_FOLDER/npm-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_YARN="timeout $BENCH_TIMEOUT corepack yarn@1 run build > $BENCH_OUTPUT_FOLDER/yarn-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_BERRY="timeout $BENCH_TIMEOUT corepack yarn@latest run build > $BENCH_OUTPUT_FOLDER/berry-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_ZPM="timeout $BENCH_TIMEOUT yarn run build > $BENCH_OUTPUT_FOLDER/zpm-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_PNPM="timeout $BENCH_TIMEOUT corepack pnpm@latest run build > $BENCH_OUTPUT_FOLDER/pnpm-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_PACQUET="timeout $BENCH_TIMEOUT /tmp/pnpm12/bin/pnpm run build > $BENCH_OUTPUT_FOLDER/pacquet-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_VLT="timeout $BENCH_TIMEOUT vlt run build --view=human > $BENCH_OUTPUT_FOLDER/vlt-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_BUN="timeout $BENCH_TIMEOUT bun run build > $BENCH_OUTPUT_FOLDER/bun-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_DENO="timeout $BENCH_TIMEOUT deno run build > $BENCH_OUTPUT_FOLDER/deno-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_AUBE="timeout $BENCH_TIMEOUT aube run build > $BENCH_OUTPUT_FOLDER/aube-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_NX="timeout $BENCH_TIMEOUT nx run build > $BENCH_OUTPUT_FOLDER/nx-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_TURBO="timeout $BENCH_TIMEOUT turbo run build --dangerously-disable-package-manager-check --cache-dir=.cache --no-cache > $BENCH_OUTPUT_FOLDER/turbo-warm-build-output.log 2>&1"
BENCH_WARM_BUILD_NODE="timeout $BENCH_TIMEOUT node --run build > $BENCH_OUTPUT_FOLDER/node-warm-build-output.log 2>&1"

# Timed build commands (the actual benchmark — rebuild with .next/ cache).
BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT npm run build > $BENCH_OUTPUT_FOLDER/npm-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="timeout $BENCH_TIMEOUT corepack yarn@1 run build > $BENCH_OUTPUT_FOLDER/yarn-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="timeout $BENCH_TIMEOUT corepack yarn@latest run build > $BENCH_OUTPUT_FOLDER/berry-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="timeout $BENCH_TIMEOUT yarn run build > $BENCH_OUTPUT_FOLDER/zpm-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="timeout $BENCH_TIMEOUT corepack pnpm@latest run build > $BENCH_OUTPUT_FOLDER/pnpm-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PACQUET="timeout $BENCH_TIMEOUT /tmp/pnpm12/bin/pnpm run build > $BENCH_OUTPUT_FOLDER/pacquet-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="timeout $BENCH_TIMEOUT vlt run build --view=human > $BENCH_OUTPUT_FOLDER/vlt-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="timeout $BENCH_TIMEOUT bun run build > $BENCH_OUTPUT_FOLDER/bun-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="timeout $BENCH_TIMEOUT deno run build > $BENCH_OUTPUT_FOLDER/deno-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AUBE="timeout $BENCH_TIMEOUT aube run build > $BENCH_OUTPUT_FOLDER/aube-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_NX="timeout $BENCH_TIMEOUT nx run build > $BENCH_OUTPUT_FOLDER/nx-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_TURBO="timeout $BENCH_TIMEOUT turbo run build --dangerously-disable-package-manager-check --cache-dir=.cache --no-cache > $BENCH_OUTPUT_FOLDER/turbo-build-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_NODE="timeout $BENCH_TIMEOUT node --run build > $BENCH_OUTPUT_FOLDER/node-build-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Run the benchmark build-cache benchmarks.
# Prepare: install deps + run a warm build (populates .next/ cache).
# Timed command: rebuild with .next/ cache present.
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  ${BENCH_INCLUDE_NPM:+--prepare="$BENCH_INSTALL_PREPARE_NPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_NPM || true"} \
  ${BENCH_INCLUDE_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_YARN:+--prepare="$BENCH_INSTALL_PREPARE_YARN || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_YARN || true"} \
  ${BENCH_INCLUDE_YARN:+--command-name="yarn" "$BENCH_COMMAND_YARN"} \
  ${BENCH_INCLUDE_BERRY:+--prepare="$BENCH_INSTALL_PREPARE_BERRY || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_BERRY || true"} \
  ${BENCH_INCLUDE_BERRY:+--command-name="berry" "$BENCH_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_ZPM:+--prepare="$BENCH_INSTALL_PREPARE_ZPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_ZPM || true"} \
  ${BENCH_INCLUDE_ZPM:+--command-name="zpm" "$BENCH_COMMAND_ZPM"} \
  ${BENCH_INCLUDE_PNPM:+--prepare="$BENCH_INSTALL_PREPARE_PNPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_PNPM || true"} \
  ${BENCH_INCLUDE_PNPM:+--command-name="pnpm" "$BENCH_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_PACQUET:+--prepare="$BENCH_INSTALL_PREPARE_PACQUET || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_PACQUET || true"} \
  ${BENCH_INCLUDE_PACQUET:+--command-name="pacquet" "$BENCH_COMMAND_PACQUET"} \
  ${BENCH_INCLUDE_VLT:+--prepare="$BENCH_INSTALL_PREPARE_VLT || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_VLT || true"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--prepare="$BENCH_INSTALL_PREPARE_BUN || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_BUN || true"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--prepare="$BENCH_INSTALL_PREPARE_DENO || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_DENO || true"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"} \
  ${BENCH_INCLUDE_AUBE:+--prepare="$BENCH_INSTALL_PREPARE_AUBE || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_AUBE || true"} \
  ${BENCH_INCLUDE_AUBE:+--command-name="aube" "$BENCH_COMMAND_AUBE"} \
  ${BENCH_INCLUDE_NX:+--prepare="$BENCH_INSTALL_PREPARE_NPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_NX || true"} \
  ${BENCH_INCLUDE_NX:+--command-name="nx" "$BENCH_COMMAND_NX"} \
  ${BENCH_INCLUDE_TURBO:+--prepare="$BENCH_INSTALL_PREPARE_NPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_TURBO || true"} \
  ${BENCH_INCLUDE_TURBO:+--command-name="turbo" "$BENCH_COMMAND_TURBO"} \
  ${BENCH_INCLUDE_NODE:+--prepare="$BENCH_INSTALL_PREPARE_NPM || true; bash $BENCH_SCRIPTS/clean-helpers.sh clean_build_output; $BENCH_WARM_BUILD_NODE || true"} \
  ${BENCH_INCLUDE_NODE:+--command-name="node" "$BENCH_COMMAND_NODE"}
