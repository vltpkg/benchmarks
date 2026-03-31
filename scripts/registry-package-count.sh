# Exit on error
set -Eeuxo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: A results folder path is required"
  exit 1
else
  BENCH_PACKAGE_COUNT_FOLDER="$1"
fi

if [ -z "${2:-}" ]; then
  echo "Error: A registry name is required"
  exit 1
else
  BENCH_REGISTRY_NAME="$2"
fi

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
  echo "Warning: node_modules directory does not exist"
  exit 0
fi

# if we couldn't determine the package count, then just exit
if [ -z "${BENCH_PACKAGE_COUNT+x}" ] || [ "$BENCH_PACKAGE_COUNT" = "0" ]; then
  echo "Warning: Could not determine the package count"
  exit 0
fi

# Create the results directory if it doesn't exist and write the count file
mkdir -p "$BENCH_PACKAGE_COUNT_FOLDER"
echo "$BENCH_PACKAGE_COUNT" >> "$BENCH_PACKAGE_COUNT_FOLDER/$BENCH_REGISTRY_NAME-count.txt"
