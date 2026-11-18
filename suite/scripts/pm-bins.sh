# Where setup.sh installs yarn classic and yarn berry, and the binaries the
# variations call. Sourced by setup.sh, variations/common.sh and
# clean-helpers.sh.
#
# Yarn 1 (`npm install --global yarn@1`), Yarn 4 (Corepack's `yarn` shim) and
# Yarn 6 (Yarn Switch) all install a `yarn` command. Each one lives in its own
# directory, none of them on PATH except Yarn Switch, and every benchmark calls
# them by full path so it's never ambiguous which one runs. pnpm has no clash
# and is called as plain `pnpm` (installed with `npm install -g` by setup.sh).
BENCH_PM_HOME="${BENCH_PM_HOME:-$HOME/.bench-pms}"

# Yarn 1, installed with npm into its own prefix.
BENCH_YARN_PREFIX="$BENCH_PM_HOME/yarn"
BENCH_YARN_BIN="$BENCH_YARN_PREFIX/bin/yarn"

# Yarn 4, through Corepack installed with npm into its own prefix: the corepack
# package ships `yarn` and `pnpm` shims of its own, which would collide with
# the npm-installed pnpm in the global prefix. Each berry benchmark pins the
# version setup.sh resolved in package.json#packageManager, like a project
# set up with `yarn set version`, and runs the `yarn` shim.
BENCH_COREPACK_PREFIX="$BENCH_PM_HOME/corepack"
BENCH_COREPACK_BIN="$BENCH_COREPACK_PREFIX/bin/corepack"
BENCH_BERRY_BIN="$BENCH_COREPACK_PREFIX/bin/yarn"
BENCH_BERRY_VERSION_FILE="$BENCH_PM_HOME/berry-version"
BENCH_BERRY_VERSION="${BENCH_BERRY_VERSION:-$(cat "$BENCH_BERRY_VERSION_FILE" 2>/dev/null || true)}"

# Yarn 6 (zpm), installed by the Yarn Switch installer.
BENCH_ZPM_BIN="$HOME/.yarn/switch/bin/yarn"
