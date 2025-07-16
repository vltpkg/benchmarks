# Exit on error
set -Eeuxo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: A results folder path is required"
  exit 1
else
  BENCH_PACKAGE_COUNT_FOLDER="$1"
fi

infer_package_manager() {
  if [[ -f "deno.lock" ]]; then
    echo "deno"
  elif [[ -f "bun.lockb" || -f "bun.lock" ]]; then
    echo "bun"
  elif [[ -f "vlt-lock.json" ]]; then
    echo "vlt"
  elif [[ -f "pnpm-lock.yaml" ]]; then
    echo "pnpm"
  elif [[ -f "yarn.lock" ]]; then
    if [[ -d ".yarn" ]]; then
      echo "berry"
    else
      echo "yarn"
    fi
  elif [[ -f "package-lock.json" ]]; then
    echo "npm"
  else
    echo "Error: Could not infer package manager" >&2
    exit 1
  fi
}

BENCH_PACKAGE_COUNT=$(
  find node_modules -name package.json -type f \
  | grep -E 'node_modules/([a-zA-Z0-9_-]+)/package\.json$|node_modules/@[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+/package\.json$' \
  | wc -l \
  | xargs
) || echo "0"

BENCH_PACKAGE_MANAGER=$(
  infer_package_manager
)

# Create the results directory if it doesn't exist
mkdir -p "$BENCH_PACKAGE_COUNT_FOLDER"
echo "$BENCH_PACKAGE_COUNT" >> "$BENCH_PACKAGE_COUNT_FOLDER/$BENCH_PACKAGE_MANAGER-count.txt"
