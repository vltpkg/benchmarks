# Exit on error
set -Eeuxo pipefail

# remove the overlap package (per-fixture package whose deps overlap the existing graph) from an
# installed project (lockfile + node_modules + warm cache). See add-remove.sh.
BENCH_AR_MODE="remove"
BENCH_AR_KIND="overlap"
source "$1/variations/add-remove.sh"
