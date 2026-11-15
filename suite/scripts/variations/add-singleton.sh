# Exit on error
set -Eeuxo pipefail

# add the singleton package (@vltpkg/xdg, zero dependencies) to an
# installed project (lockfile + node_modules + warm cache). See add-remove.sh.
BENCH_AR_MODE="add"
BENCH_AR_KIND="singleton"
source "$1/variations/add-remove.sh"
