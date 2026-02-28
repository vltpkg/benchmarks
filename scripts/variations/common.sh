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
BENCH_INCLUDE="${BENCH_INCLUDE:=npm,yarn,berry,zpm,pnpm,vlt,bun,deno,nx,turbo,node}"
BENCH_WARMUP="${BENCH_WARMUP:=2}"
BENCH_RUNS="${BENCH_RUNS:=10}"
for pm in npm yarn berry zpm pnpm vlt bun deno nx turbo node; do
  CHOICE=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
  if echo "$BENCH_INCLUDE" | grep -qw "$pm"; then
    # Only allow nx, turbo, node if BENCH_VARIATION is "run"
    if [[ "$pm" == "nx" || "$pm" == "turbo" || "$pm" == "node" ]]; then
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
BENCH_SETUP_VLT=""
BENCH_SETUP_BUN=""
BENCH_SETUP_DENO=""
BENCH_SETUP_NX=""
BENCH_SETUP_TURBO=""
BENCH_SETUP_NODE=""


BENCH_COMMAND_NPM="npm install --no-audit --no-fund --silent $SCRIPTS_FLAG >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="corepack yarn@1 install --silent $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BERRY="corepack yarn@latest install $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="yarn install --silent $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="corepack pnpm@latest install --silent $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="vlt install --view=silent $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="bun install --silent $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="deno install --allow-scripts --quiet $SCRIPTS_FLAG > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"

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
  for pm in npm yarn berry zpm pnpm vlt bun deno nx turbo node; do
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
