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
BENCH_INCLUDE="${BENCH_INCLUDE:=npm,yarn,berry,pnpm,vlt,bun,deno,nx,turbo,node}"
BENCH_WARMUP="${BENCH_WARMUP:=2}"
BENCH_RUNS="${BENCH_RUNS:=10}"
for pm in npm yarn berry pnpm vlt bun deno nx turbo node; do
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
BENCH_COMMAND_NPM="npm install --no-audit --no-fund --silent >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN="corepack yarn@1 install --silent > $BENCH_OUTPUT_FOLDER/yarn-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_YARN_MODERN_CONFIG=$(cat <<EOF
enableImmutableInstalls: false
enableMirror: false
nodeLinker: node-modules
EOF
)
BENCH_COMMAND_BERRY="echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml; corepack yarn@latest install > $BENCH_OUTPUT_FOLDER/berry-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_ZPM="echo \"$BENCH_COMMAND_YARN_MODERN_CONFIG\" > .yarnrc.yml; yarn install --silent > $BENCH_OUTPUT_FOLDER/zpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_PNPM="corepack pnpm@latest install --silent > $BENCH_OUTPUT_FOLDER/pnpm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT="vlt install --view=silent > $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_BUN="bun install --silent > $BENCH_OUTPUT_FOLDER/bun-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_DENO="deno install --allow-scripts --quiet > $BENCH_OUTPUT_FOLDER/deno-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Clean up & create the results directory
rm -rf "$BENCH_OUTPUT_FOLDER"
mkdir -p "$BENCH_OUTPUT_FOLDER"

# Function to collect package count into a package-count.json file
collect_package_count() {
  ls -la "$BENCH_OUTPUT_FOLDER"

  # Prints the output of each install
  for pm in npm yarn berry pnpm vlt bun deno nx turbo node; do
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
