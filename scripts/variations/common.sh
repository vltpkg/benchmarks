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
BENCH_INCLUDE="${BENCH_INCLUDE:=npm,yarn,berry,zpm,pnpm,pnpm11,vlt,bun,deno,aube,nx,turbo,vp,node}"
BENCH_WARMUP="${BENCH_WARMUP:=2}"
BENCH_RUNS="${BENCH_RUNS:=5}"
# Per-command timeout in seconds (default: 5 minutes).
# If a single install exceeds this, it is killed. hyperfine --ignore-failure
# lets the suite continue; the timed-out run records as a failure.
BENCH_TIMEOUT="${BENCH_TIMEOUT:=300}"
for pm in npm yarn berry zpm pnpm pnpm11 vlt bun deno aube nx turbo vp node; do
  CHOICE=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
  if echo "$BENCH_INCLUDE" | grep -qw "$pm"; then
    # Only allow nx, turbo, vp, node if BENCH_VARIATION is "run"
    if [[ "$pm" == "nx" || "$pm" == "turbo" || "$pm" == "vp" || "$pm" == "node" ]]; then
      if [ "$BENCH_VARIATION" = "run" ]; then
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
BENCH_SETUP_YARN=""
BENCH_SETUP_BERRY="echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml"
BENCH_SETUP_ZPM="echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml; { echo '[zpm prepare]'; echo 'cwd:'; pwd; echo 'package.json:'; ls -la package.json || true; echo 'yarn path:'; command -v yarn || true; echo 'yarn version:'; yarn -v || true; echo 'canary version:'; echo \"$BENCH_ZPM_VERSION\"; echo 'packageManager (before):'; npm pkg get packageManager || true; echo 'set packageManager=yarn@'"$BENCH_ZPM_VERSION"':' ; npm pkg set packageManager=\"yarn@$BENCH_ZPM_VERSION\" || true; echo 'packageManager (after):'; npm pkg get packageManager || true; } >> $BENCH_OUTPUT_FOLDER/zpm-prepare.log 2>&1"
BENCH_SETUP_PNPM=""
BENCH_SETUP_PNPM11=""
BENCH_SETUP_VLT="node $BENCH_SCRIPTS/add-workspace-protocol.js . >> $BENCH_OUTPUT_FOLDER/vlt-prepare.log 2>&1"
BENCH_SETUP_BUN=""
BENCH_SETUP_DENO=""
BENCH_SETUP_AUBE="npm pkg delete packageManager >/dev/null 2>&1 || true"
BENCH_SETUP_NX=""
BENCH_SETUP_TURBO=""
BENCH_SETUP_VP=""
BENCH_SETUP_NODE=""

# Bare install commands (no log redirection) — used by strace process counting.
# Install scripts are disabled where the PM runs them by default, so benchmarks
# measure dependency resolution + linking only (not arbitrary postinstall work).
#   npm, yarn classic, bun: run scripts by default → --ignore-scripts
#   berry, zpm, pnpm v10+, vlt: don't run scripts by default → no flag needed
#   pnpm v11+: errors on ignored build scripts (ERR_PNPM_IGNORED_BUILDS) → --ignore-scripts
#   deno: doesn't run scripts by default → removed --allow-scripts
BENCH_INSTALL_NPM="npm install --no-audit --no-fund --ignore-scripts --silent"
# npm ERESOLVE: medium-draft@0.5.18 requires react@^15||^16 but large has react@^18
if [ "$BENCH_FIXTURE" = "large" ]; then
  BENCH_INSTALL_NPM="$BENCH_INSTALL_NPM --legacy-peer-deps"
fi
BENCH_INSTALL_YARN="corepack yarn@1 install --ignore-scripts --silent"
BENCH_INSTALL_BERRY="corepack yarn@latest install"
BENCH_INSTALL_ZPM="yarn install --silent"
BENCH_INSTALL_PNPM="corepack pnpm@latest install --silent"
BENCH_INSTALL_PNPM11="corepack pnpm@next-11 install --ignore-scripts --silent"
BENCH_INSTALL_VLT="vlt install --view=silent"
BENCH_INSTALL_BUN="bun install --ignore-scripts --silent"
BENCH_INSTALL_DENO="deno install --quiet"
BENCH_INSTALL_AUBE="aube install --silent"

BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_NPM >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="timeout $BENCH_TIMEOUT $BENCH_INSTALL_YARN > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="timeout $BENCH_TIMEOUT $BENCH_INSTALL_BERRY > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_ZPM > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="timeout $BENCH_TIMEOUT $BENCH_INSTALL_PNPM > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM11="timeout $BENCH_TIMEOUT $BENCH_INSTALL_PNPM11 > $BENCH_OUTPUT_FOLDER/pnpm11-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="timeout $BENCH_TIMEOUT $BENCH_INSTALL_VLT > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="timeout $BENCH_TIMEOUT $BENCH_INSTALL_BUN > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="timeout $BENCH_TIMEOUT $BENCH_INSTALL_DENO > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AUBE="timeout $BENCH_TIMEOUT $BENCH_INSTALL_AUBE > $BENCH_OUTPUT_FOLDER/aube-output-\${HYPERFINE_ITERATION}.log 2>&1"

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
  for pm in npm yarn berry zpm pnpm pnpm11 vlt bun deno aube nx turbo vp node; do
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
# Runs a single strace'd install for each included package manager under the
# same state as the benchmark variation. BENCH_PREPARE_BASE must be set by the
# calling variation script before invoking this function.
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
    [pnpm11]="$BENCH_SETUP_PNPM11"
    [vlt]="$BENCH_SETUP_VLT"
    [bun]="$BENCH_SETUP_BUN"
    [deno]="$BENCH_SETUP_DENO"
    [aube]="$BENCH_SETUP_AUBE"
  )
  local -A PM_INSTALL=(
    [npm]="$BENCH_INSTALL_NPM"
    [yarn]="$BENCH_INSTALL_YARN"
    [berry]="$BENCH_INSTALL_BERRY"
    [zpm]="$BENCH_INSTALL_ZPM"
    [pnpm]="$BENCH_INSTALL_PNPM"
    [pnpm11]="$BENCH_INSTALL_PNPM11"
    [vlt]="$BENCH_INSTALL_VLT"
    [bun]="$BENCH_INSTALL_BUN"
    [deno]="$BENCH_INSTALL_DENO"
    [aube]="$BENCH_INSTALL_AUBE"
  )
  local -A PM_INCLUDE=(
    [npm]="$BENCH_INCLUDE_NPM"
    [yarn]="$BENCH_INCLUDE_YARN"
    [berry]="$BENCH_INCLUDE_BERRY"
    [zpm]="$BENCH_INCLUDE_ZPM"
    [pnpm]="$BENCH_INCLUDE_PNPM"
    [pnpm11]="$BENCH_INCLUDE_PNPM11"
    [vlt]="$BENCH_INCLUDE_VLT"
    [bun]="$BENCH_INCLUDE_BUN"
    [deno]="$BENCH_INCLUDE_DENO"
    [aube]="$BENCH_INCLUDE_AUBE"
  )

  for pm in npm yarn berry zpm pnpm pnpm11 vlt bun deno aube; do
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

  node "$BENCH_SCRIPTS/collect-process-count.js" "$BENCH_OUTPUT_FOLDER"
}
