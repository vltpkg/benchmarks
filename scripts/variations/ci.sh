# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# CI variation: frozen-lockfile install (lockfile + cache present, no node_modules).
# Each package manager uses its dedicated "ci" / frozen-lockfile command.
# This simulates a typical CI pipeline where the lockfile is committed and
# caches may be restored from a previous run, but node_modules is absent.
#
# Unlike other variations that use the regular install commands from common.sh,
# this variation overrides both the install commands (for benchmarking) and the
# prepare steps (each PM must generate its own lockfile via regular install
# before the ci command can run).

# --- CI commands (what we benchmark) ---
BENCH_CI_NPM="npm ci --no-audit --no-fund --ignore-scripts --silent"
if [ "$BENCH_FIXTURE" = "large" ]; then
  BENCH_CI_NPM="$BENCH_CI_NPM --legacy-peer-deps"
fi
BENCH_CI_YARN="corepack yarn@1 install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_BERRY="corepack yarn@latest install --immutable"
BENCH_CI_ZPM="yarn install --immutable --silent"
BENCH_CI_PNPM="corepack pnpm@latest install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_PACQUET="/tmp/pnpm12/bin/pnpm install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_VLT="vlt ci --view=silent"
BENCH_CI_BUN="bun install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_DENO="deno install --frozen --quiet"
BENCH_CI_AUBE="aube ci --silent"

# Override BENCH_COMMAND_* with CI commands + log redirection
BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT $BENCH_CI_NPM >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="timeout $BENCH_TIMEOUT $BENCH_CI_YARN > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="timeout $BENCH_TIMEOUT $BENCH_CI_BERRY > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="timeout $BENCH_TIMEOUT $BENCH_CI_ZPM > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="timeout $BENCH_TIMEOUT $BENCH_CI_PNPM > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PACQUET="timeout $BENCH_TIMEOUT $BENCH_CI_PACQUET > $BENCH_OUTPUT_FOLDER/pacquet-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="timeout $BENCH_TIMEOUT $BENCH_CI_VLT > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="timeout $BENCH_TIMEOUT $BENCH_CI_BUN > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="timeout $BENCH_TIMEOUT $BENCH_CI_DENO > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AUBE="timeout $BENCH_TIMEOUT $BENCH_CI_AUBE > $BENCH_OUTPUT_FOLDER/aube-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Override bare install commands for strace process counting
BENCH_INSTALL_NPM="$BENCH_CI_NPM"
BENCH_INSTALL_YARN="$BENCH_CI_YARN"
BENCH_INSTALL_BERRY="$BENCH_CI_BERRY"
BENCH_INSTALL_ZPM="$BENCH_CI_ZPM"
BENCH_INSTALL_PNPM="$BENCH_CI_PNPM"
BENCH_INSTALL_PACQUET="$BENCH_CI_PACQUET"
BENCH_INSTALL_VLT="$BENCH_CI_VLT"
BENCH_INSTALL_BUN="$BENCH_CI_BUN"
BENCH_INSTALL_DENO="$BENCH_CI_DENO"
BENCH_INSTALL_AUBE="$BENCH_CI_AUBE"

# --- Prepare commands ---
# CI commands require a lockfile to exist. Each PM's prepare step:
#   1. Cleans node_modules, lockfiles, and PM files from the previous PM
#   2. Cleans the packageManager field to avoid devEngines conflicts
#   3. Runs the PM-specific setup (e.g. .yarnrc.yml for berry/zpm)
#   4. Runs a regular install to generate the lockfile + populate cache
#   5. Cleans node_modules so the ci command starts from scratch
#
# This is more expensive than other variations' prepare steps, but accurately
# measures the CI use case: lockfile present, cache warm, node_modules absent.
BENCH_CLEAN_PRE="bash $BENCH_SCRIPTS/clean-helpers.sh clean_node_modules clean_lockfiles clean_package_manager_files clean_package_manager_field"
BENCH_CLEAN_POST="bash $BENCH_SCRIPTS/clean-helpers.sh clean_node_modules clean_package_manager_files"

# Helper: build per-PM prepare that generates a lockfile then cleans node_modules
ci_prepare() {
  local setup_cmd="$1"
  local install_cmd="$2"
  local result="sleep 1; $BENCH_CLEAN_PRE"
  if [ -n "$setup_cmd" ]; then
    result="$result; $setup_cmd"
  fi
  result="$result; $install_cmd >/dev/null 2>&1 || true; $BENCH_CLEAN_POST"
  echo "$result"
}

# Regular (non-ci) install commands to generate lockfiles during prepare
_INSTALL_NPM="npm install --no-audit --no-fund --ignore-scripts --silent"
if [ "$BENCH_FIXTURE" = "large" ]; then
  _INSTALL_NPM="$_INSTALL_NPM --legacy-peer-deps"
fi

BENCH_PREPARE_NPM="$(ci_prepare "$BENCH_SETUP_NPM" "$_INSTALL_NPM")"
BENCH_PREPARE_YARN="$(ci_prepare "$BENCH_SETUP_YARN" "corepack yarn@1 install --ignore-scripts --silent")"
BENCH_PREPARE_BERRY="$(ci_prepare "$BENCH_SETUP_BERRY" "corepack yarn@latest install")"
BENCH_PREPARE_ZPM="$(ci_prepare "$BENCH_SETUP_ZPM" "yarn install --silent")"
BENCH_PREPARE_PNPM="$(ci_prepare "$BENCH_SETUP_PNPM" "corepack pnpm@latest install --ignore-scripts --silent")"
BENCH_PREPARE_PACQUET="$(ci_prepare "$BENCH_SETUP_PACQUET" "/tmp/pnpm12/bin/pnpm install --ignore-scripts --silent")"
BENCH_PREPARE_VLT="$(ci_prepare "$BENCH_SETUP_VLT" "vlt install --view=silent")"
BENCH_PREPARE_BUN="$(ci_prepare "$BENCH_SETUP_BUN" "bun install --ignore-scripts --silent")"
BENCH_PREPARE_DENO="$(ci_prepare "$BENCH_SETUP_DENO" "deno install --quiet")"
BENCH_PREPARE_AUBE="$(ci_prepare "$BENCH_SETUP_AUBE" "aube install --silent")"

# Run the benchmark suite
hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --conclude="sleep 1; bash $BENCH_SCRIPTS/package-count.sh $BENCH_OUTPUT_FOLDER; bash $BENCH_SCRIPTS/clean-helpers.sh clean_node_modules clean_lockfiles clean_package_manager_files clean_package_manager_field clean_build_files" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  ${BENCH_INCLUDE_NPM:+--prepare="$BENCH_PREPARE_NPM"} \
  ${BENCH_INCLUDE_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_YARN:+--prepare="$BENCH_PREPARE_YARN"} \
  ${BENCH_INCLUDE_YARN:+--command-name="yarn" "$BENCH_COMMAND_YARN"} \
  ${BENCH_INCLUDE_BERRY:+--prepare="$BENCH_PREPARE_BERRY"} \
  ${BENCH_INCLUDE_BERRY:+--command-name="berry" "$BENCH_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_ZPM:+--prepare="$BENCH_PREPARE_ZPM"} \
  ${BENCH_INCLUDE_ZPM:+--command-name="zpm" "$BENCH_COMMAND_ZPM"} \
  ${BENCH_INCLUDE_PNPM:+--prepare="$BENCH_PREPARE_PNPM"} \
  ${BENCH_INCLUDE_PNPM:+--command-name="pnpm" "$BENCH_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_PACQUET:+--prepare="$BENCH_PREPARE_PACQUET"} \
  ${BENCH_INCLUDE_PACQUET:+--command-name="pacquet" "$BENCH_COMMAND_PACQUET"} \
  ${BENCH_INCLUDE_VLT:+--prepare="$BENCH_PREPARE_VLT"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--prepare="$BENCH_PREPARE_BUN"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--prepare="$BENCH_PREPARE_DENO"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"} \
  ${BENCH_INCLUDE_AUBE:+--prepare="$BENCH_PREPARE_AUBE"} \
  ${BENCH_INCLUDE_AUBE:+--command-name="aube" "$BENCH_COMMAND_AUBE"}

collect_package_count

# For process counting, use a representative prepare base.
# collect_process_count needs BENCH_PREPARE_BASE to set up state before strace.
BENCH_PREPARE_BASE="$BENCH_PREPARE_NPM"
collect_process_count
