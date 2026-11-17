# Shared implementation of the add-singleton, remove-singleton, add-overlap
# and remove-overlap variations. Sourced by those four scripts after they set:
#
#   BENCH_AR_MODE  add | remove
#   BENCH_AR_KIND  singleton | overlap
#
# What is measured: adding (or removing) ONE dependency to (or from) an
# already-installed project, using each package manager's own add/remove
# command. Starting state for every timed run is identical per package
# manager: package.json + that PM's lockfile + node_modules + warm cache
# (i.e. cache+lockfile+node_modules), restored from a snapshot by
# scripts/add-remove-state.sh. For remove-*, the snapshot is taken after the
# PM itself added the package, so the package is in package.json, the
# lockfile and node_modules.

# Load common variables (also clears + creates $BENCH_OUTPUT_FOLDER)
source "$1/variations/common.sh"

# --- Package under test ---------------------------------------------------
#
# singleton: @vltpkg/xdg@1.8.0 has no dependencies, peerDependencies,
# optionalDependencies or bundleDependencies, and is not in any fixture's
# graph, so adding it is "fetch + link exactly one new package".
#
# overlap: a package that is NOT already in the fixture's graph but whose own
# dependencies mostly ARE, so the package manager has to resolve the new
# subtree against the existing graph and dedupe/hoist onto packages it already
# has. Picked per fixture (counts measured against an npm lockfile of each
# fixture; "closure" = packages the spec installs into an empty project):
#
#   next     log-symbols@4.1.0            closure 8, 6 already present:
#            chalk@4 + ansi-styles/supports-color/has-flag/color-* come in
#            via the next/tailwind toolchain; only is-unicode-supported is new
#   astro    @rollup/plugin-replace@6.0.3 closure 7, 6 present:
#   vue      @rollup/pluginutils, magic-string, estree-walker, picomatch via
#            vite/rollup (peer rollup also present)
#   svelte   @rollup/plugin-replace@6.0.3 closure 7, 4 present: magic-string,
#            picomatch, rollup (peer) via vite; @rollup/pluginutils is new
#   large    react-redux@9.2.0            react (peer), redux (optional peer)
#            and use-sync-external-store already present; only
#            @types/use-sync-external-store is new
#   babylon  del@9.0.1                    closure 28, 18 present: globby,
#            fast-glob, p-map, slash, is-glob, micromatch... via the
#            jest/webpack/eslint toolchain. Several are present at OTHER
#            majors, so this is the case that exercises nested placement /
#            dedupe rather than pure reuse.
#
# Versions are pinned so the graph change is the same every night.
BENCH_AR_SINGLETON_NAME="@vltpkg/xdg"
BENCH_AR_SINGLETON_SPEC="@vltpkg/xdg@1.8.0"
case "$BENCH_FIXTURE" in
  next)
    BENCH_AR_OVERLAP_NAME="log-symbols"
    BENCH_AR_OVERLAP_SPEC="log-symbols@4.1.0"
    ;;
  astro|svelte|vue)
    BENCH_AR_OVERLAP_NAME="@rollup/plugin-replace"
    BENCH_AR_OVERLAP_SPEC="@rollup/plugin-replace@6.0.3"
    ;;
  large)
    BENCH_AR_OVERLAP_NAME="react-redux"
    BENCH_AR_OVERLAP_SPEC="react-redux@9.2.0"
    ;;
  babylon)
    BENCH_AR_OVERLAP_NAME="del"
    BENCH_AR_OVERLAP_SPEC="del@9.0.1"
    ;;
  *)
    echo "Error: no overlap package configured for fixture '$BENCH_FIXTURE'"
    exit 1
    ;;
esac

if [ "$BENCH_AR_KIND" = "singleton" ]; then
  AR_NAME="$BENCH_AR_SINGLETON_NAME"
  AR_SPEC="$BENCH_AR_SINGLETON_SPEC"
else
  AR_NAME="$BENCH_AR_OVERLAP_NAME"
  AR_SPEC="$BENCH_AR_OVERLAP_SPEC"
fi
echo "add-remove: mode=$BENCH_AR_MODE kind=$BENCH_AR_KIND package=$AR_SPEC fixture=$BENCH_FIXTURE"

# Workspace roots: yarn classic, pnpm and aube refuse to add to the root of a
# workspace without an explicit flag.
AR_WS_YARN=""
AR_WS_PNPM=""
if [ -f pnpm-workspace.yaml ] || [ "$(node -e 'process.stdout.write(String(!!require("./package.json").workspaces))')" = "true" ]; then
  AR_WS_YARN=" -W"
  AR_WS_PNPM=" -w"
fi

# --- Add / remove commands ------------------------------------------------
# Same flags as each PM's install command in common.sh (scripts disabled where
# the PM runs them by default, quiet output).
AR_NPM_FLAGS="--no-audit --no-fund --ignore-scripts --silent"
if [ "$BENCH_FIXTURE" = "large" ]; then
  AR_NPM_FLAGS="$AR_NPM_FLAGS --legacy-peer-deps"
fi
BENCH_ADD_NPM="npm install $AR_SPEC $AR_NPM_FLAGS"
BENCH_ADD_YARN="$BENCH_YARN_BIN add $AR_SPEC$AR_WS_YARN --ignore-scripts --silent"
BENCH_ADD_BERRY="$BENCH_BERRY_BIN add $AR_SPEC"
BENCH_ADD_ZPM="$BENCH_ZPM_BIN add $AR_SPEC"
BENCH_ADD_PNPM="pnpm add $AR_SPEC$AR_WS_PNPM --ignore-scripts --silent"
BENCH_ADD_VLT="vlt install $AR_SPEC --view=silent"
BENCH_ADD_BUN="bun add $AR_SPEC --ignore-scripts --silent"
BENCH_ADD_DENO="deno add --quiet npm:$AR_SPEC"
BENCH_ADD_AUBE="aube add $AR_SPEC$AR_WS_PNPM --ignore-scripts --silent"
BENCH_ADD_UPM="upm add $AR_SPEC --silent"

BENCH_REMOVE_NPM="npm uninstall $AR_NAME $AR_NPM_FLAGS"
BENCH_REMOVE_YARN="$BENCH_YARN_BIN remove $AR_NAME$AR_WS_YARN --ignore-scripts --silent"
BENCH_REMOVE_BERRY="$BENCH_BERRY_BIN remove $AR_NAME"
BENCH_REMOVE_ZPM="$BENCH_ZPM_BIN remove $AR_NAME"
BENCH_REMOVE_PNPM="pnpm remove $AR_NAME$AR_WS_PNPM --ignore-scripts --silent"
BENCH_REMOVE_VLT="vlt uninstall $AR_NAME --view=silent"
BENCH_REMOVE_BUN="bun remove $AR_NAME --ignore-scripts --silent"
BENCH_REMOVE_DENO="deno remove --quiet npm:$AR_NAME"
BENCH_REMOVE_AUBE="aube remove $AR_NAME$AR_WS_PNPM --ignore-scripts --silent"
BENCH_REMOVE_UPM="upm remove $AR_NAME --silent"

PMS=(npm yarn berry zpm pnpm vlt bun deno aube upm)

# Snapshot lives outside the results folder so it is never uploaded.
BENCH_AR_STATE_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/bench-add-remove/$BENCH_FIXTURE-$BENCH_VARIATION"

# The timed command per PM, and the bare command for process counting.
for pm in "${PMS[@]}"; do
  P=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
  if [ "$BENCH_AR_MODE" = "add" ]; then
    bare_var="BENCH_ADD_$P"
  else
    bare_var="BENCH_REMOVE_$P"
  fi
  eval "BENCH_OP_$P=\"\${$bare_var}\""
  # A failed baseline (see add-remove-state.sh) fails the run instead of
  # timing an add/remove against a broken project.
  eval "BENCH_COMMAND_$P=\"[ ! -e $BENCH_AR_STATE_DIR/failed ] && timeout $BENCH_TIMEOUT \${$bare_var} > $BENCH_OUTPUT_FOLDER/$pm-output-\\\${HYPERFINE_ITERATION}.log 2>&1\""
  export "BENCH_SETUP_$P" "BENCH_INSTALL_$P" "BENCH_ADD_$P"
done
export BENCH_OUTPUT_FOLDER
ar_prepare() {
  echo "sleep 1; bash $BENCH_SCRIPTS/add-remove-state.sh prepare $BENCH_AR_STATE_DIR $1 $BENCH_AR_MODE"
}
BENCH_AR_DESTROY="bash $BENCH_SCRIPTS/add-remove-state.sh destroy $BENCH_AR_STATE_DIR"

hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup="$BENCH_WARMUP" \
  --runs="$BENCH_RUNS" \
  --setup="$BENCH_AR_DESTROY; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  --conclude="sleep 1; bash $BENCH_SCRIPTS/package-count.sh $BENCH_OUTPUT_FOLDER" \
  --cleanup="$BENCH_AR_DESTROY; bash $BENCH_SCRIPTS/clean-helpers.sh clean_all" \
  ${BENCH_INCLUDE_NPM:+--prepare="$(ar_prepare npm)"} \
  ${BENCH_INCLUDE_NPM:+--command-name="npm" "$BENCH_COMMAND_NPM"} \
  ${BENCH_INCLUDE_YARN:+--prepare="$(ar_prepare yarn)"} \
  ${BENCH_INCLUDE_YARN:+--command-name="yarn" "$BENCH_COMMAND_YARN"} \
  ${BENCH_INCLUDE_BERRY:+--prepare="$(ar_prepare berry)"} \
  ${BENCH_INCLUDE_BERRY:+--command-name="berry" "$BENCH_COMMAND_BERRY"} \
  ${BENCH_INCLUDE_ZPM:+--prepare="$(ar_prepare zpm)"} \
  ${BENCH_INCLUDE_ZPM:+--command-name="zpm" "$BENCH_COMMAND_ZPM"} \
  ${BENCH_INCLUDE_PNPM:+--prepare="$(ar_prepare pnpm)"} \
  ${BENCH_INCLUDE_PNPM:+--command-name="pnpm" "$BENCH_COMMAND_PNPM"} \
  ${BENCH_INCLUDE_VLT:+--prepare="$(ar_prepare vlt)"} \
  ${BENCH_INCLUDE_VLT:+--command-name="vlt" "$BENCH_COMMAND_VLT"} \
  ${BENCH_INCLUDE_BUN:+--prepare="$(ar_prepare bun)"} \
  ${BENCH_INCLUDE_BUN:+--command-name="bun" "$BENCH_COMMAND_BUN"} \
  ${BENCH_INCLUDE_DENO:+--prepare="$(ar_prepare deno)"} \
  ${BENCH_INCLUDE_DENO:+--command-name="deno" "$BENCH_COMMAND_DENO"} \
  ${BENCH_INCLUDE_AUBE:+--prepare="$(ar_prepare aube)"} \
  ${BENCH_INCLUDE_AUBE:+--command-name="aube" "$BENCH_COMMAND_AUBE"} \
  ${BENCH_INCLUDE_UPM:+--prepare="$(ar_prepare upm)"} \
  ${BENCH_INCLUDE_UPM:+--command-name="upm" "$BENCH_COMMAND_UPM"}

collect_package_count

# Process counts: same starting state as the timed runs (snapshot restore),
# then one strace'd add/remove per PM. Mirrors collect_process_count in
# common.sh, which assumes a single shared prepare and so can't be reused.
if command -v strace &>/dev/null; then
  for pm in "${PMS[@]}"; do
    P=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
    include_var="BENCH_INCLUDE_$P"
    op_var="BENCH_OP_$P"
    if [ -n "${!include_var:-}" ]; then
      # Prepare here rather than in process-count.sh so a failed baseline
      # skips the count instead of counting a broken add/remove.
      eval "$(ar_prepare "$pm")"
      if [ -e "$BENCH_AR_STATE_DIR/failed" ]; then
        echo "Warning: baseline failed for $pm, skipping process count"
        continue
      fi
      bash "$BENCH_SCRIPTS/process-count.sh" "$BENCH_OUTPUT_FOLDER" "$pm" "${!op_var}"
    fi
  done
  eval "$BENCH_AR_DESTROY"
  bash "$BENCH_SCRIPTS/clean-helpers.sh" clean_all
  node "$BENCH_SCRIPTS/collect-process-count.js" "$BENCH_OUTPUT_FOLDER"
else
  echo "Warning: strace not available, skipping process count collection"
fi
