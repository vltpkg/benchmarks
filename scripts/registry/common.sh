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

# Special handling for babylon fixture - setup the repository
if [ "$BENCH_FIXTURE" = "babylon" ]; then
  echo "Setting up Babylon.js fixture..."
  if [ -f "setup.sh" ]; then
    bash setup.sh
  else
    echo "Warning: setup.sh not found for babylon fixture"
  fi
fi

# Defines configurable values for the benchmark
BENCH_WARMUP="${BENCH_WARMUP:=2}"
BENCH_RUNS="${BENCH_RUNS:=10}"
BENCH_LOGLEVEL="${BENCH_LOGLEVEL:=silent}"
BENCH_OUTPUT_FOLDER="$BENCH_RESULTS/$BENCH_FIXTURE/$BENCH_VARIATION"

# Add --ignore-scripts for babylon fixture to skip complex build pipeline
SCRIPTS_FLAG=""
if [ "$BENCH_FIXTURE" = "babylon" ]; then
  SCRIPTS_FLAG="--ignore-scripts"
fi

# Add --force for large fixture to bypass peer dependency errors
FORCE_FLAG=""
if [ "$BENCH_FIXTURE" = "large" ]; then
  FORCE_FLAG="--force"
fi

# Base npm install command (without .npmrc setup)
# --prefer-online ensures npm always fetches from the network rather than
# relying on any cached metadata, so we measure actual registry performance.
BENCH_NPM_INSTALL="npm install --prefer-online --no-audit --no-fund --no-update-notifier --loglevel=$BENCH_LOGLEVEL $SCRIPTS_FLAG $FORCE_FLAG"

# Registry definitions
BENCH_REGISTRY_NPM_URL="https://registry.npmjs.org/"
BENCH_REGISTRY_VLT_URL="https://registry.vlt.io/npm/"
BENCH_REGISTRY_AWS_URL="https://vlt-451504312483.d.codeartifact.us-east-1.amazonaws.com/npm/code-artifact-benchmark-test/"
BENCH_REGISTRY_AWS_NPMRC_KEY="${BENCH_REGISTRY_AWS_URL#https://}"

# Registry setup commands run in hyperfine --prepare (untimed, before each run).
# Auth token is written as a literal placeholder so npm resolves it from env.
BENCH_SETUP_REGISTRY_NPM="npm config set registry \"$BENCH_REGISTRY_NPM_URL\" --location=project"
BENCH_SETUP_REGISTRY_VLT="npm config set registry \"$BENCH_REGISTRY_VLT_URL\" --location=project"
BENCH_SETUP_REGISTRY_AWS="npm config set registry \"$BENCH_REGISTRY_AWS_URL\" --location=project && npm config set \"//${BENCH_REGISTRY_AWS_NPMRC_KEY}:_authToken=\${CODEARTIFACT_AUTH_TOKEN}\" --location=project"

# Registry verification helper runs in hyperfine --conclude (untimed, after each run).
BENCH_VERIFY_REGISTRY="echo '--- effective registry ---' && npm config get registry && echo '--- lockfile resolved sample ---' && (grep -m3 '\"resolved\"' package-lock.json 2>/dev/null || echo 'no lockfile yet') && echo '---'"
BENCH_CONCLUDE_NPM="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_CONCLUDE_VLT_REG="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_CONCLUDE_AWS="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/aws-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Registry commands are timed and should only run installs.
BENCH_COMMAND_NPM="$BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT_REG="$BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AWS="$BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/aws-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Registry include flags
# If BENCH_INCLUDE_REGISTRY is not set, default to running all registries.
if [ -z "${BENCH_INCLUDE_REGISTRY:-}" ]; then
  BENCH_INCLUDE_REGISTRY="npm,vlt,aws"
fi

BENCH_INCLUDE_REG_NPM=""
BENCH_INCLUDE_REG_VLT=""
BENCH_INCLUDE_REG_AWS=""

for entry in $(echo "$BENCH_INCLUDE_REGISTRY" | tr ',' '\n'); do
  case "$entry" in
    "")           continue ;;
    npm)          BENCH_INCLUDE_REG_NPM=1 ;;
    vlt)          BENCH_INCLUDE_REG_VLT=1 ;;
    aws)          BENCH_INCLUDE_REG_AWS=1 ;;
    *)
      echo "Error: Unknown registry '$entry' in BENCH_INCLUDE_REGISTRY"
      exit 1
      ;;
  esac
done

if [ -n "$BENCH_INCLUDE_REG_AWS" ] && [ -z "${CODEARTIFACT_AUTH_TOKEN:-}" ]; then
  echo "Error: 'aws' registry was requested, but CODEARTIFACT_AUTH_TOKEN is not set"
  exit 1
fi

echo "Registry benchmarks will run: $BENCH_INCLUDE_REGISTRY"

# Clean up & create the results directory
rm -rf "$BENCH_OUTPUT_FOLDER"
mkdir -p "$BENCH_OUTPUT_FOLDER"

# Cleanup function for .npmrc
registry_cleanup() {
  bash "$BENCH_SCRIPTS/clean-helpers.sh" clean_npmrc
}
