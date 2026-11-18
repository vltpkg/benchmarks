# Exit on error
set -Eeuxo pipefail

# Required parameters
if [ -z "${1:-}" ]; then
  echo "Error: A scripts folder path is required"
  exit 1
else
  BENCH_SCRIPTS="$1"
fi

if [ -z "${2:-}" ]; then
  echo "Error: A results folder path is required"
  exit 1
else
  BENCH_RESULTS="$2"
fi

if [ -z "${3:-}" ]; then
  echo "Error: A fixture name is required"
  exit 1
else
  BENCH_FIXTURE="$3"
fi

if [ -z "${4:-}" ]; then
  echo "Error: A variation name is required"
  exit 1
else
  BENCH_VARIATION="$4"
fi

# Defines configurable values for the benchmark
BENCH_INCLUDE="${BENCH_INCLUDE:=npm,yarn,berry,zpm,pnpm,vlt,bun,deno,aube,upm,nx,turbo,vp,node}"
BENCH_WARMUP="${BENCH_WARMUP:=2}"
BENCH_RUNS="${BENCH_RUNS:=5}"
# Per-command timeout in seconds (default: 5 minutes).
# If a single install exceeds this, it is killed. hyperfine --ignore-failure
# lets the suite continue; the timed-out run records as a failure.
BENCH_TIMEOUT="${BENCH_TIMEOUT:=300}"
# process-count.sh runs as its own script and times its counted command too
export BENCH_TIMEOUT
for pm in npm yarn berry zpm pnpm vlt bun deno aube upm nx turbo vp node; do
  CHOICE=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
  if echo "$BENCH_INCLUDE" | grep -qw "$pm"; then
    # Only allow nx, turbo, vp, node for task-runner variations (run, build, build-cache)
    if [[ "$pm" == "nx" || "$pm" == "turbo" || "$pm" == "vp" || "$pm" == "node" ]]; then
      if [[ "$BENCH_VARIATION" = "run" || "$BENCH_VARIATION" = "build" || "$BENCH_VARIATION" = "build-cache" ]]; then
        eval "BENCH_INCLUDE_${CHOICE}=1"
      else
        eval "BENCH_INCLUDE_${CHOICE}="
      fi
    else
      eval "BENCH_INCLUDE_${CHOICE}=1"
    fi
  else
    eval "BENCH_INCLUDE_${CHOICE}="
  fi
done
BENCH_OUTPUT_FOLDER="$BENCH_RESULTS/$BENCH_FIXTURE/$BENCH_VARIATION"
# Where yarn classic, berry and zpm live (BENCH_YARN_BIN, BENCH_BERRY_BIN, ...)
source "$BENCH_SCRIPTS/pm-bins.sh"
if [ -n "$BENCH_INCLUDE_BERRY" ] && [ -z "$BENCH_BERRY_VERSION" ]; then
  echo "Error: no berry version in $BENCH_BERRY_VERSION_FILE; run scripts/setup.sh first"
  exit 1
fi
BENCH_COMMAND_YARN_MODERN_CONFIG=$(cat <<EOF
enableImmutableInstalls: false
enableMirror: false
nodeLinker: node-modules
EOF
)
BENCH_ZPM_VERSION="${BENCH_ZPM_VERSION:-$(curl -fsSL "https://repo.yarnpkg.com/channels/default/canary" | tr -d '[:space:]' || true)}"
if [ -z "$BENCH_ZPM_VERSION" ]; then
  BENCH_ZPM_VERSION="6.0.0-rc.13"
fi
BENCH_SETUP_NPM=""
# Yarn 1 refuses to run when packageManager names another yarn (berry/zpm pins).
BENCH_SETUP_YARN="npm pkg delete packageManager >/dev/null 2>&1 || true"
# Yarn walks up to the repo-root package.json and refuses to install a fixture
# that is not one of its workspaces. An empty yarn.lock marks the fixture as its
# own project; touch leaves an existing (restored) lockfile untouched.
# The packageManager pin is how a Yarn 4 project selects its version through
# Corepack (what `yarn set version` writes).
BENCH_SETUP_BERRY="touch yarn.lock; echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml; npm pkg set packageManager=yarn@$BENCH_BERRY_VERSION"
BENCH_SETUP_ZPM="touch yarn.lock; echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml; { echo '[zpm prepare]'; echo 'cwd:'; pwd; echo 'package.json:'; ls -la package.json || true; echo 'yarn path:'; echo $BENCH_ZPM_BIN; echo 'yarn version:'; $BENCH_ZPM_BIN -v || true; echo 'canary version:'; echo \"$BENCH_ZPM_VERSION\"; echo 'packageManager (before):'; npm pkg get packageManager || true; echo 'set packageManager=yarn@'"$BENCH_ZPM_VERSION"':' ; npm pkg set packageManager=\"yarn@$BENCH_ZPM_VERSION\" || true; echo 'packageManager (after):'; npm pkg get packageManager || true; } >> $BENCH_OUTPUT_FOLDER/zpm-prepare.log 2>&1"
BENCH_SETUP_PNPM="npm pkg delete packageManager >/dev/null 2>&1 || true"

BENCH_SETUP_VLT=""
BENCH_SETUP_BUN=""
BENCH_SETUP_DENO=""
BENCH_SETUP_AUBE="npm pkg delete packageManager >/dev/null 2>&1 || true"
BENCH_SETUP_UPM=""
# nx needs a local copy of itself and an Nx workspace; a global nx alone fails
# with "isn't part of an Nx workspace" / "Could not find Nx modules". The next
# fixture has neither, and adding nx as a devDependency would change what every
# install variation on next measures. So the nx build prepares install the same
# nx version as the global one (setup.sh) without saving it, and mark
# package.json as a workspace. Cleanup restores package.json (git checkout) and
# removes node_modules.
BENCH_NX_VERSION="$(node -p "require('$(npm root -g)/nx/package.json').version" 2>/dev/null || echo latest)"
BENCH_SETUP_NX="npm install --no-save --no-audit --no-fund --ignore-scripts --silent nx@$BENCH_NX_VERSION && npm pkg set nx='{}' --json"
BENCH_SETUP_TURBO=""
# vp install delegates to Yarn 4, so it needs the same yarn.lock as berry above.
BENCH_SETUP_VP="touch yarn.lock"
BENCH_SETUP_NODE=""

# Bare install commands (no log redirection) — used by strace process counting.
# Install scripts are disabled where the PM runs them by default, so benchmarks
# measure dependency resolution + linking only (not arbitrary postinstall work).
#   npm, yarn classic, bun: run scripts by default → --ignore-scripts
#   pnpm v11+: errors on ignored build scripts (ERR_PNPM_IGNORED_BUILDS) → --ignore-scripts
#   aube: runs scripts for its default trusted dependencies → --ignore-scripts
#   berry, zpm, vlt: don't run scripts by default → no flag needed
#   deno: doesn't run scripts by default → removed --allow-scripts
BENCH_INSTALL_NPM="npm install --no-audit --no-fund --ignore-scripts --silent"
# npm ERESOLVE: medium-draft@0.5.18 requires react@^15||^16 but large has react@^18
if [ "$BENCH_FIXTURE" = "large" ]; then
  BENCH_INSTALL_NPM="$BENCH_INSTALL_NPM --legacy-peer-deps"
fi
BENCH_INSTALL_YARN="$BENCH_YARN_BIN install --ignore-scripts --silent"
BENCH_INSTALL_BERRY="$BENCH_BERRY_BIN install"
BENCH_INSTALL_ZPM="$BENCH_ZPM_BIN install --silent"
BENCH_INSTALL_PNPM="pnpm install --ignore-scripts --silent"
# vlt uses the npm registry alias configured by each fixture's vlt.json.
BENCH_INSTALL_VLT="vlt install --view=silent"
BENCH_INSTALL_BUN="bun install --ignore-scripts --silent"
BENCH_INSTALL_DENO="deno install --quiet"
BENCH_INSTALL_AUBE="aube install --ignore-scripts --silent"
BENCH_INSTALL_UPM="upm install --silent"

BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_NPM >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="timeout $BENCH_TIMEOUT $BENCH_INSTALL_YARN > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="timeout $BENCH_TIMEOUT $BENCH_INSTALL_BERRY > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_ZPM > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_PNPM > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="timeout $BENCH_TIMEOUT $BENCH_INSTALL_VLT > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="timeout $BENCH_TIMEOUT $BENCH_INSTALL_BUN > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="timeout $BENCH_TIMEOUT $BENCH_INSTALL_DENO > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AUBE="timeout $BENCH_TIMEOUT $BENCH_INSTALL_AUBE > $BENCH_OUTPUT_FOLDER/aube-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_UPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_UPM > $BENCH_OUTPUT_FOLDER/upm-output-\${HYPERFINE_ITERATION}.log 2>&1"

# hyperfine waits for vlt's background cache unpacking around every
# prepare/setup/cleanup. See hyperfine-wait.sh.
source "$BENCH_SCRIPTS/hyperfine-wait.sh"

# Clean up & create the results directory
rm -rf "$BENCH_OUTPUT_FOLDER"
mkdir -p "$BENCH_OUTPUT_FOLDER"

append_setup() {
  local base="$1"
  local setup="$2"

  if [ -n "$setup" ]; then
    echo "$base; $setup"
  else
    echo "$base"
  fi
}

prepend_setup() {
  local base="$1"
  local setup="$2"

  if [ -n "$setup" ]; then
    echo "$setup; $base"
  else
    echo "$base"
  fi
}

# Function to collect package count into a package-count.json file
collect_package_count() {
  ls -la "$BENCH_OUTPUT_FOLDER"

  # Prints the output of each install
  for pm in npm yarn berry zpm pnpm vlt bun deno aube upm nx turbo vp node; do
    if echo "$BENCH_INCLUDE" | grep -qw "$pm"; then
      for i in {0..9}; do
        echo "-- Reading output of $pm install $i ---"
        log_file="$BENCH_OUTPUT_FOLDER/${pm}-output-$i.log"
        if [ -f "$log_file" ]; then
          echo "---"
          cat "$log_file"
          echo "---"
        fi
        echo "--------------------------------"
      done
    fi
  done

  node "$BENCH_SCRIPTS/collect-package-count.js" "$BENCH_OUTPUT_FOLDER"
}

# Function to collect spawned process counts via strace.
# Runs a single strace'd install for each included package manager, one after
# another, with one shared prepare. Only right when that prepare resets
# everything (clean); otherwise a tool starts from what the previous one left,
# so use set_per_pm_prepares and collect_process_count_per_pm. BENCH_PREPARE_BASE
# must be set by the calling variation script before invoking this function.
collect_process_count() {
  if ! command -v strace &>/dev/null; then
    echo "Warning: strace not available, skipping process count collection"
    return 0
  fi

  echo "=== Collecting spawned process counts ==="

  # Map of pm name -> setup command and bare install command
  local -A PM_SETUP=(
    [npm]="$BENCH_SETUP_NPM"
    [yarn]="$BENCH_SETUP_YARN"
    [berry]="$BENCH_SETUP_BERRY"
    [zpm]="$BENCH_SETUP_ZPM"
    [pnpm]="$BENCH_SETUP_PNPM"
    [vlt]="$BENCH_SETUP_VLT"
    [bun]="$BENCH_SETUP_BUN"
    [deno]="$BENCH_SETUP_DENO"
    [aube]="$BENCH_SETUP_AUBE"
    [upm]="$BENCH_SETUP_UPM"
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
      local prepare_cmd="$BENCH_PREPARE_BASE"
      local setup="${PM_SETUP[$pm]:-}"
      if [ -n "$setup" ]; then
        prepare_cmd="$prepare_cmd; $setup"
      fi

      bash "$BENCH_SCRIPTS/process-count.sh" \
        "$BENCH_OUTPUT_FOLDER" \
        "$pm" \
        "${PM_INSTALL[$pm]}" \
        "$prepare_cmd"
    fi
  done

  # Collect first, so a failing clean can't lose the counts. Then don't leave
  # the last tool's node_modules, lockfile and cache behind.
  node "$BENCH_SCRIPTS/collect-process-count.js" "$BENCH_OUTPUT_FOLDER"
  bash "$BENCH_SCRIPTS/clean-helpers.sh" wait_for_vlt_background clean_all
}

# Like collect_process_count, but each package manager gets its own prepare,
# BENCH_PREPARE_<PM>, as in the timed runs. For variations whose prepare
# depends on the tool, e.g. `ci` needs the tool's own lockfile.
collect_process_count_per_pm() {
  if ! command -v strace &>/dev/null; then
    echo "Warning: strace not available, skipping process count collection"
    return 0
  fi

  echo "=== Collecting spawned process counts (per-PM prepare) ==="

  local pm P include_var install_var prepare_var
  for pm in npm yarn berry zpm pnpm vlt bun deno aube upm; do
    P=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
    include_var="BENCH_INCLUDE_$P"
    install_var="BENCH_INSTALL_$P"
    prepare_var="BENCH_PREPARE_$P"
    if [ -n "${!include_var:-}" ]; then
      bash "$BENCH_SCRIPTS/process-count.sh" \
        "$BENCH_OUTPUT_FOLDER" \
        "$pm" \
        "${!install_var}" \
        "${!prepare_var}"
    fi
  done

  # Collect first, so a failing clean can't lose the counts. Then don't leave
  # the last tool's node_modules, lockfile and cache behind.
  node "$BENCH_SCRIPTS/collect-process-count.js" "$BENCH_OUTPUT_FOLDER"
  bash "$BENCH_SCRIPTS/clean-helpers.sh" wait_for_vlt_background clean_all
}

# For variations whose starting state is what the tool itself left behind:
# its own lockfile, node_modules or cache. Sets each BENCH_PREPARE_<PM> to what
# the timed runs do before a measured run: clean_all (hyperfine --setup), one
# install that leaves that state (a warmup run), then the variation's prepare
# again. So the counted install starts from its own state and nothing another
# tool left. BENCH_PREPARE_BASE must be set before calling this.
set_per_pm_prepares() {
  local pm P setup_var install_var prepare
  for pm in npm yarn berry zpm pnpm vlt bun deno aube upm; do
    P=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
    setup_var="BENCH_SETUP_$P"
    install_var="BENCH_INSTALL_$P"
    prepare="$(append_setup "$BENCH_PREPARE_BASE" "${!setup_var}")"
    printf -v "BENCH_PREPARE_$P" '%s' "bash $BENCH_SCRIPTS/clean-helpers.sh clean_all; $prepare; ${!install_var} >/dev/null 2>&1 || true; bash $BENCH_SCRIPTS/clean-helpers.sh wait_for_vlt_background; $prepare"
  done
}
