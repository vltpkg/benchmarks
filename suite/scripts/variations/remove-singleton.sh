# Exit on error
set -Eeuxo pipefail

# remove the singleton package (@vltpkg/xdg, zero dependencies) from an
# installed project (lockfile + node_modules + warm cache). See add-remove.sh.
BENCH_AR_MODE="remove"
BENCH_AR_KIND="singleton"
source "$1/variations/add-remove.sh"
