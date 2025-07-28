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
    # can't infer package manager, so we'll skip this run
    echo "none"
  fi
}

# If the node_modules directory exists, count the number of packages
if [ -d "node_modules" ]; then
  BENCH_PACKAGE_COUNT=$(
    find node_modules -name package.json -type f \
    | grep -E 'node_modules/([a-zA-Z0-9_-]+)/package\.json$|node_modules/@[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+/package\.json$' \
    | sort -u \
    | wc -l \
    | xargs
  ) || true
else
  # if there is no node_modules directory, the install failed
  # and we can't infer the package manager, so we'll skip this run
  echo "Warning: node_modules directory does not exist"
  exit 0
fi

# if we couldn't determine the package count, then just exit, no count file will be created
if [ -z "${BENCH_PACKAGE_COUNT+x}" ] || [ "$BENCH_PACKAGE_COUNT" = "0" ]; then
  # if the package count couldn't be determined, the install likely failed
  # and we can't infer the package manager, so we'll skip this run
  echo "Warning: Could not determine the package count"
  exit 0
fi

BENCH_PACKAGE_MANAGER=$(
  infer_package_manager
)

# if we couldn't determine the package manager, then just exit, no count file will be created
if [ -z "${BENCH_PACKAGE_MANAGER+x}" ] || [ "$BENCH_PACKAGE_MANAGER" = "none" ]; then
  echo "Warning: Could not determine the package manager"
  exit 0
fi

# Create the results directory if it doesn't exist
if [ -n "$BENCH_PACKAGE_MANAGER" ] && [ "$BENCH_PACKAGE_MANAGER" != "none" ]; then
  mkdir -p "$BENCH_PACKAGE_COUNT_FOLDER"
  echo "$BENCH_PACKAGE_COUNT" >> "$BENCH_PACKAGE_COUNT_FOLDER/$BENCH_PACKAGE_MANAGER-count.txt"
fi
