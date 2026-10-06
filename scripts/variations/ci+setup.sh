# Exit on error
set -Eeuxo pipefail

# Load common variables
source "$1/variations/common.sh"

# CI + Setup variation: measures PM installation AND frozen-lockfile install.
# Identical to the `ci` variation but wraps the PM binary installation into the
# measured command, so the benchmark captures the end-to-end time of setting up
# the tool from scratch and running a CI install.
#
# Prepare step (not measured):
#   1. Clean node_modules, lockfiles, PM files
#   2. Install the PM binary (needed to generate the lockfile)
#   3. Run a regular install to generate the lockfile + populate cache
#   4. Clean node_modules (ci starts from scratch)
#   5. Uninstall the PM binary (so the measured step re-installs it)
#
# Measured command:
#   1. Install the PM binary
#   2. Run the PM's ci/frozen-lockfile command

# Use an isolated corepack home so purging it between runs doesn't affect
# other benchmarks, and so the path is deterministic (no reliance on
# `corepack cache path` which is not a documented subcommand).
export COREPACK_HOME="/tmp/bench-corepack-home"

# --- PM install commands ---
# These mirror what scripts/setup.sh does for each PM.

# npm: install into a dedicated prefix so the bootstrap npm and its cache are
# separate from the dependency-level npm cache used by `npm ci`.
NPM_SETUP_PREFIX="/tmp/bench-npm"
NPM_SETUP_CACHE="/tmp/bench-npm-cache"
SETUP_INSTALL_NPM="npm install -g npm@latest --prefix $NPM_SETUP_PREFIX --cache $NPM_SETUP_CACHE >/dev/null 2>&1"
SETUP_INSTALL_YARN=""  # corepack auto-downloads on first invocation
SETUP_INSTALL_BERRY="" # corepack auto-downloads on first invocation
# zpm is installed via the Yarn Switch installer (same as setup.sh)
SETUP_INSTALL_ZPM="curl -sS https://repo.yarnpkg.com/install | bash >/dev/null 2>&1"
SETUP_INSTALL_PNPM=""  # corepack auto-downloads on first invocation
SETUP_INSTALL_VLT="npm install -g vlt@latest >/dev/null 2>&1"
SETUP_INSTALL_BUN="npm install -g --allow-scripts=bun bun@latest >/dev/null 2>&1"
SETUP_INSTALL_DENO="npm install -g --allow-scripts=deno deno@latest >/dev/null 2>&1"
SETUP_INSTALL_AUBE="npm install -g --allow-scripts=@endevco/aube @endevco/aube@latest >/dev/null 2>&1"
SETUP_INSTALL_UPM="npm install -g upm@latest >/dev/null 2>&1"

# --- PM uninstall commands (run at end of prepare to force re-install) ---
SETUP_UNINSTALL_NPM="rm -rf $NPM_SETUP_PREFIX $NPM_SETUP_CACHE"
SETUP_UNINSTALL_YARN="" # corepack managed; cache purged below
SETUP_UNINSTALL_BERRY=""
SETUP_UNINSTALL_ZPM="rm -rf \$HOME/.yarn/switch >/dev/null 2>&1 || true"
SETUP_UNINSTALL_PNPM=""
SETUP_UNINSTALL_VLT="npm uninstall -g vlt >/dev/null 2>&1 || true"
SETUP_UNINSTALL_BUN="npm uninstall -g bun >/dev/null 2>&1 || true"
SETUP_UNINSTALL_DENO="npm uninstall -g deno >/dev/null 2>&1 || true"
SETUP_UNINSTALL_AUBE="npm uninstall -g @endevco/aube >/dev/null 2>&1 || true"
SETUP_UNINSTALL_UPM="npm uninstall -g upm >/dev/null 2>&1 || true"

# Purge the isolated corepack home so corepack-managed PMs must re-download.
COREPACK_PURGE="rm -rf $COREPACK_HOME"

# --- CI commands (same as ci variation) ---
BENCH_CI_NPM="$NPM_SETUP_PREFIX/bin/npm ci --no-audit --no-fund --ignore-scripts --silent"
if [ "$BENCH_FIXTURE" = "large" ]; then
  BENCH_CI_NPM="$BENCH_CI_NPM --legacy-peer-deps"
fi
BENCH_CI_YARN="corepack yarn@1 install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_BERRY="corepack yarn@latest install --immutable"
BENCH_CI_ZPM="yarn install --immutable --silent"
BENCH_CI_PNPM="corepack pnpm@latest install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_VLT="vlt ci --view=silent"
BENCH_CI_BUN="bun install --frozen-lockfile --ignore-scripts --silent"
BENCH_CI_DENO="deno install --frozen --quiet"
BENCH_CI_AUBE="aube ci --ignore-scripts --silent"
BENCH_CI_UPM="upm install --frozen-lockfile --silent"

# --- Build measured commands: install PM + ci command ---
# Helper to combine PM install + ci command. Uses && so a failed PM
# installation fails fast instead of silently falling through to the
# ci command (which could succeed against a stale binary left behind).
setup_and_ci() {
  local install_pm="$1"
  local ci_cmd="$2"
  if [ -n "$install_pm" ]; then
    echo "$install_pm && $ci_cmd"
  else
    echo "$ci_cmd"
  fi
}

BENCH_COMBINED_NPM="$(setup_and_ci "$SETUP_INSTALL_NPM" "$BENCH_CI_NPM")"
BENCH_COMBINED_YARN="$(setup_and_ci "" "$BENCH_CI_YARN")"       # corepack download is part of the yarn invocation
BENCH_COMBINED_BERRY="$(setup_and_ci "" "$BENCH_CI_BERRY")"
BENCH_COMBINED_ZPM="$(setup_and_ci "$SETUP_INSTALL_ZPM" "$BENCH_CI_ZPM")"
BENCH_COMBINED_PNPM="$(setup_and_ci "" "$BENCH_CI_PNPM")"
BENCH_COMBINED_VLT="$(setup_and_ci "$SETUP_INSTALL_VLT" "$BENCH_CI_VLT")"
BENCH_COMBINED_BUN="$(setup_and_ci "$SETUP_INSTALL_BUN" "$BENCH_CI_BUN")"
BENCH_COMBINED_DENO="$(setup_and_ci "$SETUP_INSTALL_DENO" "$BENCH_CI_DENO")"
BENCH_COMBINED_AUBE="$(setup_and_ci "$SETUP_INSTALL_AUBE" "$BENCH_CI_AUBE")"
BENCH_COMBINED_UPM="$(setup_and_ci "$SETUP_INSTALL_UPM" "$BENCH_CI_UPM")"

# Override BENCH_COMMAND_* with combined commands + log redirection
BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_NPM' >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_YARN' > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_BERRY' > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_ZPM' > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_PNPM' > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_VLT' > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_BUN' > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_DENO' > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AUBE="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_AUBE' > $BENCH_OUTPUT_FOLDER/aube-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_UPM="timeout $BENCH_TIMEOUT bash -c '$BENCH_COMBINED_UPM' > $BENCH_OUTPUT_FOLDER/upm-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Override bare install commands for strace process counting (uses combined commands)
BENCH_INSTALL_NPM="bash -c '$BENCH_COMBINED_NPM'"
BENCH_INSTALL_YARN="bash -c '$BENCH_COMBINED_YARN'"
BENCH_INSTALL_BERRY="bash -c '$BENCH_COMBINED_BERRY'"
BENCH_INSTALL_ZPM="bash -c '$BENCH_COMBINED_ZPM'"
BENCH_INSTALL_PNPM="bash -c '$BENCH_COMBINED_PNPM'"
BENCH_INSTALL_VLT="bash -c '$BENCH_COMBINED_VLT'"
BENCH_INSTALL_BUN="bash -c '$BENCH_COMBINED_BUN'"
BENCH_INSTALL_DENO="bash -c '$BENCH_COMBINED_DENO'"
BENCH_INSTALL_AUBE="bash -c '$BENCH_COMBINED_AUBE'"
BENCH_INSTALL_UPM="bash -c '$BENCH_COMBINED_UPM'"

# --- Prepare commands ---
# Like the ci variation, prepare generates a lockfile. Additionally, it
# uninstalls the PM binary so the measured command includes re-installing it.
BENCH_CLEAN_PRE="bash $BENCH_SCRIPTS/clean-helpers.sh clean_node_modules clean_lockfiles clean_package_manager_files clean_package_manager_field"
BENCH_CLEAN_POST="bash $BENCH_SCRIPTS/clean-helpers.sh clean_node_modules clean_package_manager_files"

# Helper: build per-PM prepare that installs PM, generates lockfile, cleans
# node_modules, then uninstalls the PM binary.
ci_setup_prepare() {
  local pm_install="$1"     # command to install the PM binary
  local setup_cmd="$2"      # PM-specific setup (e.g. .yarnrc.yml)
  local install_cmd="$3"    # regular install to generate lockfile
  local pm_uninstall="$4"   # command to uninstall the PM binary
  local corepack_purge="$5" # optional: purge corepack cache

  local result="sleep 1; $BENCH_CLEAN_PRE"

  # Install PM binary if needed (for non-corepack PMs)
  if [ -n "$pm_install" ]; then
    result="$result; $pm_install"
  fi

  # PM-specific setup
  if [ -n "$setup_cmd" ]; then
    result="$result; $setup_cmd"
  fi

  # Generate lockfile via regular install
  result="$result; $install_cmd >/dev/null 2>&1 || true"

  # Clean node_modules (ci starts fresh)
  result="$result; $BENCH_CLEAN_POST"

  # Uninstall PM binary so the measured command re-installs it
  if [ -n "$pm_uninstall" ]; then
    result="$result; $pm_uninstall"
  fi

  # Purge corepack cache if applicable
  if [ -n "$corepack_purge" ]; then
    result="$result; $corepack_purge"
  fi

  echo "$result"
}

# Regular (non-ci) install commands to generate lockfiles during prepare.
# npm uses the dedicated prefix binary for lockfile generation too.
_INSTALL_NPM="$NPM_SETUP_PREFIX/bin/npm install --no-audit --no-fund --ignore-scripts --silent"
if [ "$BENCH_FIXTURE" = "large" ]; then
  _INSTALL_NPM="$_INSTALL_NPM --legacy-peer-deps"
fi

BENCH_PREPARE_NPM="$(ci_setup_prepare "$SETUP_INSTALL_NPM" "$BENCH_SETUP_NPM" "$_INSTALL_NPM" "$SETUP_UNINSTALL_NPM" "")"
BENCH_PREPARE_YARN="$(ci_setup_prepare "$SETUP_INSTALL_YARN" "$BENCH_SETUP_YARN" "corepack yarn@1 install --ignore-scripts --silent" "$SETUP_UNINSTALL_YARN" "$COREPACK_PURGE")"
BENCH_PREPARE_BERRY="$(ci_setup_prepare "$SETUP_INSTALL_BERRY" "$BENCH_SETUP_BERRY" "corepack yarn@latest install" "$SETUP_UNINSTALL_BERRY" "$COREPACK_PURGE")"
BENCH_PREPARE_ZPM="$(ci_setup_prepare "$SETUP_INSTALL_ZPM" "$BENCH_SETUP_ZPM" "yarn install --silent" "$SETUP_UNINSTALL_ZPM" "")"
BENCH_PREPARE_PNPM="$(ci_setup_prepare "$SETUP_INSTALL_PNPM" "$BENCH_SETUP_PNPM" "corepack pnpm@latest install --ignore-scripts --silent" "$SETUP_UNINSTALL_PNPM" "$COREPACK_PURGE")"
BENCH_PREPARE_VLT="$(ci_setup_prepare "$SETUP_INSTALL_VLT" "$BENCH_SETUP_VLT" "vlt install --view=silent" "$SETUP_UNINSTALL_VLT" "")"
BENCH_PREPARE_BUN="$(ci_setup_prepare "$SETUP_INSTALL_BUN" "$BENCH_SETUP_BUN" "bun install --ignore-scripts --silent" "$SETUP_UNINSTALL_BUN" "")"
BENCH_PREPARE_DENO="$(ci_setup_prepare "$SETUP_INSTALL_DENO" "$BENCH_SETUP_DENO" "deno install --quiet" "$SETUP_UNINSTALL_DENO" "")"
BENCH_PREPARE_AUBE="$(ci_setup_prepare "$SETUP_INSTALL_AUBE" "$BENCH_SETUP_AUBE" "aube install --ignore-scripts --silent" "$SETUP_UNINSTALL_AUBE" "")"
BENCH_PREPARE_UPM="$(ci_setup_prepare "$SETUP_INSTALL_UPM" "$BENCH_SETUP_UPM" "upm install --silent" "$SETUP_UNINSTALL_UPM" "")"

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
  ${BENCH_INCLUDE_VLT:+--prepare="$BENCH_PREPARE_VLT"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--prepare="$BENCH_PREPARE_BUN"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--prepare="$BENCH_PREPARE_DENO"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"} \
  ${BENCH_INCLUDE_AUBE:+--prepare="$BENCH_PREPARE_AUBE"} \
  ${BENCH_INCLUDE_AUBE:+--command-name="aube" "$BENCH_COMMAND_AUBE"} \
  ${BENCH_INCLUDE_UPM:+--prepare="$BENCH_PREPARE_UPM"} \
  ${BENCH_INCLUDE_UPM:+--command-name="upm" "$BENCH_COMMAND_UPM"}

collect_package_count

# --- Process count collection ---
# Unlike other variations that use a single BENCH_PREPARE_BASE for all PMs,
# ci+setup needs per-PM prepare commands because each PM's prepare includes
# PM-specific uninstall/cache-purge steps. Using a single base (e.g. npm's
# prepare) would leave the wrong lockfile and skip corepack purges for
# non-npm PMs, producing inaccurate process counts.
collect_process_count_per_pm() {
  if ! command -v strace &>/dev/null; then
    echo "Warning: strace not available, skipping process count collection"
    return 0
  fi

  echo "=== Collecting spawned process counts (per-PM prepare) ==="

  local -A PM_PREPARE=(
    [npm]="$BENCH_PREPARE_NPM"
    [yarn]="$BENCH_PREPARE_YARN"
    [berry]="$BENCH_PREPARE_BERRY"
    [zpm]="$BENCH_PREPARE_ZPM"
    [pnpm]="$BENCH_PREPARE_PNPM"
    [vlt]="$BENCH_PREPARE_VLT"
    [bun]="$BENCH_PREPARE_BUN"
    [deno]="$BENCH_PREPARE_DENO"
    [aube]="$BENCH_PREPARE_AUBE"
    [upm]="$BENCH_PREPARE_UPM"
  )
  local -A PM_INSTALL=(
    [npm]="$BENCH_INSTALL_NPM"
    [yarn]="$BENCH_INSTALL_YARN"
    [berry]="$BENCH_INSTALL_BERRY"
    [zpm]="$BENCH_INSTALL_ZPM"
    [pnpm]="$BENCH_INSTALL_PNPM"
    [vlt]="$BENCH_INSTALL_VLT"
    [bun]="$BENCH_INSTALL_BUN"
    [deno]="$BENCH_INSTALL_DENO"
    [aube]="$BENCH_INSTALL_AUBE"
    [upm]="$BENCH_INSTALL_UPM"
  )
  local -A PM_INCLUDE=(
    [npm]="$BENCH_INCLUDE_NPM"
    [yarn]="$BENCH_INCLUDE_YARN"
    [berry]="$BENCH_INCLUDE_BERRY"
    [zpm]="$BENCH_INCLUDE_ZPM"
    [pnpm]="$BENCH_INCLUDE_PNPM"
    [vlt]="$BENCH_INCLUDE_VLT"
    [bun]="$BENCH_INCLUDE_BUN"
    [deno]="$BENCH_INCLUDE_DENO"
    [aube]="$BENCH_INCLUDE_AUBE"
    [upm]="$BENCH_INCLUDE_UPM"
  )

  for pm in npm yarn berry zpm pnpm vlt bun deno aube upm; do
    if [ -n "${PM_INCLUDE[$pm]:-}" ]; then
      bash "$BENCH_SCRIPTS/process-count.sh" \
        "$BENCH_OUTPUT_FOLDER" \
        "$pm" \
        "${PM_INSTALL[$pm]}" \
        "${PM_PREPARE[$pm]}"
    fi
  done

  node "$BENCH_SCRIPTS/collect-process-count.js" "$BENCH_OUTPUT_FOLDER"
}

collect_process_count_per_pm
