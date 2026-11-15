# Exit on error
set -Eeuxo pipefail

# add the overlap package (per-fixture package whose deps overlap the existing graph) to an
# installed project (lockfile + node_modules + warm cache). See add-remove.sh.
BENCH_AR_MODE="add"
BENCH_AR_KIND="overlap"
source "$1/variations/add-remove.sh"
