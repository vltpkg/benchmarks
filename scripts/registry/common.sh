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
BENCH_RUNS="${BENCH_RUNS:=5}"
# Per-command timeout in seconds (default: 5 minutes)
BENCH_TIMEOUT="${BENCH_TIMEOUT:=300}"
BENCH_LOGLEVEL="${BENCH_LOGLEVEL:=http}"
BENCH_OUTPUT_FOLDER="$BENCH_RESULTS/$BENCH_FIXTURE/$BENCH_VARIATION"

# Add --force for large fixture to bypass peer dependency errors
FORCE_FLAG=""
if [ "$BENCH_FIXTURE" = "large" ]; then
  FORCE_FLAG="--force"
fi

# Base npm install command (without .npmrc setup)
# --prefer-online ensures npm always fetches from the network rather than
# relying on any cached metadata, so we measure actual registry performance.
BENCH_NPM_INSTALL="npm install --prefer-online --no-audit --no-fund --no-update-notifier --ignore-scripts --loglevel=$BENCH_LOGLEVEL $FORCE_FLAG"

# Registry definitions
BENCH_REGISTRY_NPM_URL="https://registry.npmjs.org/"
BENCH_REGISTRY_VLT_URL="https://registry.vlt.io/npm/"
BENCH_REGISTRY_VLT_URL_NPMRC_KEY="${BENCH_REGISTRY_VLT_URL#http*://}"
BENCH_REGISTRY_AWS_URL="https://vlt-451504312483.d.codeartifact.us-east-1.amazonaws.com/npm/code-artifact-benchmark-test/"
BENCH_REGISTRY_AWS_NPMRC_KEY="${BENCH_REGISTRY_AWS_URL#http*://}"
# Cloudsmith registry URL is injected without the protocol prefix
# (e.g. "//example.com/..."), so we prepend "https:" for the registry config.
# The auth .npmrc key uses the URL as-is (without protocol).
BENCH_REGISTRY_CLOUDSMITH_URL="https:${CLOUDSMITH_REGISTRY:-}"
BENCH_REGISTRY_CLOUDSMITH_NPMRC_KEY="${CLOUDSMITH_REGISTRY#//}"
# GitHub registry URL is injected without the protocol prefix
# (e.g. "//npm.pkg.github.com/..."), so we prepend "https:" for the registry config.
# The auth .npmrc key uses the URL as-is (without protocol).
BENCH_REGISTRY_GITHUB_URL="https:${GH_REGISTRY:-}"
BENCH_REGISTRY_GITHUB_NPMRC_KEY="${GH_REGISTRY#//}"

# Registry setup commands run in hyperfine --prepare (untimed, before each run).
# Auth token is written as a literal placeholder so npm resolves it from env.
# For vlt registry, a random suffix is appended to the auth token on every
# iteration (separated by `:`) so that each run uses a unique token string.
# This ensures the registry does not serve cached responses across iterations.
BENCH_SETUP_REGISTRY_NPM="npm config set registry \"$BENCH_REGISTRY_NPM_URL\" --location=project"
# The vlt registry auth token is appended with a random suffix with the iteration number to
# ensure that a fresh cache is used for each iteration. A future update to the vlt registry
# will allow sharing a public cache regardless of the authorization header.
BENCH_SETUP_REGISTRY_VLT="npm config set registry \"$BENCH_REGISTRY_VLT_URL\" --location=project && npm config set \"//${BENCH_REGISTRY_VLT_URL_NPMRC_KEY}:_authToken=\\\${VLT_REGISTRY_AUTH_TOKEN}:$(head -c 16 /dev/urandom | xxd -p)_\\\${HYPERFINE_ITERATION}\" --location=project"
BENCH_SETUP_REGISTRY_AWS="npm config set registry \"$BENCH_REGISTRY_AWS_URL\" --location=project && npm config set \"//${BENCH_REGISTRY_AWS_NPMRC_KEY}:_authToken=\\\${CODEARTIFACT_AUTH_TOKEN}\" --location=project"
BENCH_SETUP_REGISTRY_CLOUDSMITH="npm config set registry \"$BENCH_REGISTRY_CLOUDSMITH_URL\" --location=project && npm config set \"//${BENCH_REGISTRY_CLOUDSMITH_NPMRC_KEY}:_authToken=\\\${CLOUDSMITH_AUTH_TOKEN}\" --location=project"
BENCH_SETUP_REGISTRY_GITHUB="npm config set registry \"$BENCH_REGISTRY_GITHUB_URL\" --location=project && npm config set \"//${BENCH_REGISTRY_GITHUB_NPMRC_KEY}:_authToken=\\\${GH_AUTH_TOKEN}\" --location=project"

# Registry verification helper runs in hyperfine --conclude (untimed, after each run).
BENCH_VERIFY_REGISTRY="npm config get registry && ((grep -m3 '\"resolved\"' package-lock.json 2>/dev/null | sed 's/^[[:space:]]*//') || echo 'no lockfile yet') && echo ''"
# Package count collection: after each run, count installed packages and tag
# them with the registry name (e.g. npm-count.txt, vlt-count.txt, aws-count.txt).
# This uses registry-package-count.sh which writes <registry>-count.txt files.
BENCH_COLLECT_PKG_COUNT_NPM="bash $BENCH_SCRIPTS/registry-package-count.sh $BENCH_OUTPUT_FOLDER npm"
BENCH_COLLECT_PKG_COUNT_VLT="bash $BENCH_SCRIPTS/registry-package-count.sh $BENCH_OUTPUT_FOLDER vlt"
BENCH_COLLECT_PKG_COUNT_AWS="bash $BENCH_SCRIPTS/registry-package-count.sh $BENCH_OUTPUT_FOLDER aws"
BENCH_COLLECT_PKG_COUNT_CLOUDSMITH="bash $BENCH_SCRIPTS/registry-package-count.sh $BENCH_OUTPUT_FOLDER cloudsmith"
BENCH_COLLECT_PKG_COUNT_GITHUB="bash $BENCH_SCRIPTS/registry-package-count.sh $BENCH_OUTPUT_FOLDER github"
# hyperfine does not provide HYPERFINE_ITERATION in conclude hooks, so these
# write to per-registry verification logs instead of per-iteration logs.
BENCH_CONCLUDE_NPM="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/npm-verify.log 2>&1; $BENCH_COLLECT_PKG_COUNT_NPM"
BENCH_CONCLUDE_VLT_REG="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/vlt-verify.log 2>&1; $BENCH_COLLECT_PKG_COUNT_VLT"
BENCH_CONCLUDE_AWS="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/aws-verify.log 2>&1; $BENCH_COLLECT_PKG_COUNT_AWS"
BENCH_CONCLUDE_CLOUDSMITH="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/cloudsmith-verify.log 2>&1; $BENCH_COLLECT_PKG_COUNT_CLOUDSMITH"
BENCH_CONCLUDE_GITHUB="{ $BENCH_VERIFY_REGISTRY; } >> $BENCH_OUTPUT_FOLDER/github-verify.log 2>&1; $BENCH_COLLECT_PKG_COUNT_GITHUB"

# Registry commands are timed and should only run installs.
# Each command is wrapped with `timeout` to prevent runaway installs.
BENCH_COMMAND_NPM="timeout $BENCH_TIMEOUT $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/npm-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_VLT_REG="timeout $BENCH_TIMEOUT $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/vlt-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_AWS="timeout $BENCH_TIMEOUT $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/aws-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_CLOUDSMITH="timeout $BENCH_TIMEOUT $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/cloudsmith-output-\${HYPERFINE_ITERATION}.log 2>&1"
BENCH_COMMAND_GITHUB="timeout $BENCH_TIMEOUT $BENCH_NPM_INSTALL >> $BENCH_OUTPUT_FOLDER/github-output-\${HYPERFINE_ITERATION}.log 2>&1"

# Registry include flags
# If BENCH_INCLUDE_REGISTRY is not set, default to running all registries.
if [ -z "${BENCH_INCLUDE_REGISTRY:-}" ]; then
  BENCH_INCLUDE_REGISTRY="npm,vlt,aws,cloudsmith,github"
fi

BENCH_INCLUDE_REG_NPM=""
BENCH_INCLUDE_REG_VLT=""
BENCH_INCLUDE_REG_AWS=""
BENCH_INCLUDE_REG_CLOUDSMITH=""
BENCH_INCLUDE_REG_GITHUB=""

for entry in $(echo "$BENCH_INCLUDE_REGISTRY" | tr ',' '\n'); do
  case "$entry" in
    "")           continue ;;
    npm)          BENCH_INCLUDE_REG_NPM=1 ;;
    vlt)          BENCH_INCLUDE_REG_VLT=1 ;;
    aws)          BENCH_INCLUDE_REG_AWS=1 ;;
    cloudsmith)   BENCH_INCLUDE_REG_CLOUDSMITH=1 ;;
    github)       BENCH_INCLUDE_REG_GITHUB=1 ;;
    *)
      echo "Error: Unknown registry '$entry' in BENCH_INCLUDE_REGISTRY"
      exit 1
      ;;
  esac
done

if [ -n "$BENCH_INCLUDE_REG_VLT" ] && [ -z "${VLT_REGISTRY_AUTH_TOKEN:-}" ]; then
  echo "Error: 'vlt' registry was requested, but VLT_REGISTRY_AUTH_TOKEN is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_AWS" ] && [ -z "${CODEARTIFACT_AUTH_TOKEN:-}" ]; then
  echo "Error: 'aws' registry was requested, but CODEARTIFACT_AUTH_TOKEN is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_CLOUDSMITH" ] && [ -z "${CLOUDSMITH_AUTH_TOKEN:-}" ]; then
  echo "Error: 'cloudsmith' registry was requested, but CLOUDSMITH_AUTH_TOKEN is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_CLOUDSMITH" ] && [ -z "${CLOUDSMITH_REGISTRY:-}" ]; then
  echo "Error: 'cloudsmith' registry was requested, but CLOUDSMITH_REGISTRY is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_GITHUB" ] && [ -z "${GH_AUTH_TOKEN:-}" ]; then
  echo "Error: 'github' registry was requested, but GH_AUTH_TOKEN is not set"
  exit 1
fi

if [ -n "$BENCH_INCLUDE_REG_GITHUB" ] && [ -z "${GH_REGISTRY:-}" ]; then
  echo "Error: 'github' registry was requested, but GH_REGISTRY is not set"
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

# Function to collect package count data from per-registry count files into package-count.json.
# Called after the hyperfine run completes — the --conclude hooks have already
# written <registry>-count.txt files for each iteration.
collect_registry_package_count() {
  ls -la "$BENCH_OUTPUT_FOLDER"
  node "$BENCH_SCRIPTS/collect-package-count.js" "$BENCH_OUTPUT_FOLDER"
}
