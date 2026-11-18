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
  # Walk the dependency graph, as package-count.sh does. Scanning node_modules
  # with a name pattern skipped package names containing a dot (335 instead of
  # 362 on next), so registry per-package times were computed from a smaller
  # count than the package-manager ones.
  BENCH_PACKAGE_COUNT=$(
    node "$(dirname "${BASH_SOURCE[0]}")/package-count.js" .
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
