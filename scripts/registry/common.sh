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

# Base npm install command (without .npmrc setup)
BENCH_NPM_INSTALL="npm install --no-audit --no-fund --no-update-notifier --loglevel=$BENCH_LOGLEVEL $SCRIPTS_FLAG"

# Registry definitions
BENCH_REGISTRY_NPM_URL="https://registry.npmjs.org/"
BENCH_REGISTRY_VLT_URL="https://registry.vlt.io/npm/"
BENCH_REGISTRY_CODEARTIFACT_URL="https://vlt-451504312483.d.codeartifact.us-east-1.amazonaws.com/npm/code-artifact-benchmark-test/"

# Registry commands: write .npmrc, run npm install, log output
# For registries that need auth tokens, we write multi-line .npmrc files.
# Auth token env vars (\$VAR) are escaped so they expand at hyperfine runtime, not definition time.
BENCH_COMMAND_NPM="echo 'registry=$BENCH_REGISTRY_NPM_URL' >> .npmrc && $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT_REG="echo 'registry=$BENCH_REGISTRY_VLT_URL' >> .npmrc && $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT_AUTH="{ echo 'registry=$BENCH_REGISTRY_VLT_URL'; echo \"//registry.vlt.io/npm/:_authToken=\$VLT_REGISTRY_AUTH_TOKEN\"; } >> .npmrc && $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/vlt-auth-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_CODEARTIFACT="{ echo 'registry=$BENCH_REGISTRY_CODEARTIFACT_URL'; echo '//vlt-451504312483.d.codeartifact.us-east-1.amazonaws.com/npm/code-artifact-benchmark-test/:always-auth=true'; echo \"//vlt-451504312483.d.codeartifact.us-east-1.amazonaws.com/npm/code-artifact-benchmark-test/:_authToken=\$CODEARTIFACT_AUTH_TOKEN\"; } >> .npmrc && $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/codeartifact-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Registry include flags
# If BENCH_INCLUDE_REGISTRY is not set, default to running all registries.
if [ -z "${BENCH_INCLUDE_REGISTRY:-}" ]; then
  # BENCH_INCLUDE_REGISTRY="npm,vlt,vlt-auth,codeartifact"
  # disabled vlt-auth until we have a way to test it
  BENCH_INCLUDE_REGISTRY="npm,vlt,codeartifact"
fi

BENCH_INCLUDE_REG_NPM=""
BENCH_INCLUDE_REG_VLT=""
BENCH_INCLUDE_REG_VLT_AUTH=""
BENCH_INCLUDE_REG_CODEARTIFACT=""

for entry in $(echo "$BENCH_INCLUDE_REGISTRY" | tr ',' '\n'); do
  case "$entry" in
    "")           continue ;;
    npm)          BENCH_INCLUDE_REG_NPM=1 ;;
    vlt)          BENCH_INCLUDE_REG_VLT=1 ;;
    vlt-auth)     BENCH_INCLUDE_REG_VLT_AUTH=1 ;;
    codeartifact) BENCH_INCLUDE_REG_CODEARTIFACT=1 ;;
    *)
      echo "Error: Unknown registry '$entry' in BENCH_INCLUDE_REGISTRY"
      exit 1
      ;;
  esac
done

# If a protected registry is requested, token must be present.
if [ -n "$BENCH_INCLUDE_REG_VLT_AUTH" ] && [ -z "${VLT_REGISTRY_AUTH_TOKEN:-}" ]; then
  echo "Error: 'vlt-auth' registry was requested, but VLT_REGISTRY_AUTH_TOKEN is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_CODEARTIFACT" ] && [ -z "${CODEARTIFACT_AUTH_TOKEN:-}" ]; then
  echo "Error: 'codeartifact' registry was requested, but CODEARTIFACT_AUTH_TOKEN is not set"
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
