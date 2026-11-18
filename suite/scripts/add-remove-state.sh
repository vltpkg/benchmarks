#!/usr/bin/env bash
# Starting-state manager for the add-*/remove-* variations.
#
# Usage (run from the fixture directory, as hyperfine's --prepare does):
#   bash add-remove-state.sh prepare <state-dir> <pm> <add|remove>
#   bash add-remove-state.sh destroy <state-dir>
#
# `prepare` guarantees every timed run of a package manager starts from a
# byte-identical project:
#
#   - First run for <pm>: wipe the previous PM's project files (node_modules,
#     lockfiles, PM files, package.json edits), run the PM's setup and a
#     regular install (=> lockfile + node_modules + warm cache). For `remove`,
#     the package under test is then added with the PM's own add command.
#     The resulting fixture directory is snapshotted to <state-dir>. For
#     `add`, the PM's global cache directories are snapshotted too.
#   - Every later run for <pm>: rsync the snapshot back over the fixture with
#     --delete, undoing whatever the previous timed add/remove changed
#     (package.json, lockfile, node_modules, PM state files). For `add`, the
#     caches are restored the same way, so the package under test is never
#     in the cache: every timed add fetches a net-new package, while the
#     project's own packages stay cached.
#   - If the baseline install (or, for `remove`, the add) fails, no snapshot
#     is taken and <state-dir>/failed is written instead. The timed command
#     checks for it and exits non-zero, so that PM's runs are recorded as
#     failures. prepare itself still exits 0: a failing --prepare aborts
#     hyperfine for every PM, not just this one.
#
# Caches are never cleaned here: the variation is "warm project", matching
# cache+lockfile+node_modules (minus the package under test, for `add`). The
# variation script cleans all caches before and after each PM's set of runs
# (hyperfine --setup/--cleanup run once per command), like every other
# variation.
#
# Commands are read from the environment (exported by add-remove.sh):
#   BENCH_SETUP_<PM>, BENCH_INSTALL_<PM>, BENCH_ADD_<PM>, BENCH_OUTPUT_FOLDER
set -Eeuo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

action="${1:-}"
state_dir="${2:-}"
if [ -z "$action" ] || [ -z "$state_dir" ]; then
  echo "Usage: $0 prepare <state-dir> <pm> <add|remove> | destroy <state-dir>"
  exit 1
fi

if [ "$action" = "destroy" ]; then
  rm -rf "$state_dir"
  exit 0
fi

if [ "$action" != "prepare" ]; then
  echo "Unknown action: $action"
  exit 1
fi

pm="${3:?pm required}"
mode="${4:?mode required}"
PM_UPPER=$(echo "$pm" | tr '[:lower:]' '[:upper:]')
setup_var="BENCH_SETUP_${PM_UPPER}"
install_var="BENCH_INSTALL_${PM_UPPER}"
add_var="BENCH_ADD_${PM_UPPER}"

snapshot="$state_dir/project"
cache_snapshot="$state_dir/cache"

# vlt finishes some work in detached processes that can outlive the vlt
# command:
#   - It renames replaced store entries to node_modules/.vlt/.VLT.DELETE.*
#     and deletes them in the background. rsync racing that deletion fails
#     with exit 24 ("some files vanished").
#   - Its other detached children (vlt-background.sh) keep writing to its
#     cache, e.g. unpacking tarballs. A snapshot or restore taken while that
#     is still writing captures, or is undone by, a half-written cache.
# Wait for both here (untimed), never copy the trash, and treat a
# vanished-file warning as success. Two clear checks in a row are required.
# Unlike wait_for_vlt_background in clean-helpers.sh, this returns non-zero if
# the work is still running after 300s, and the caller then fails this PM
# rather than snapshot or restore a cache still being written.
source "$SCRIPTS_DIR/vlt-background.sh"

wait_for_pm_background() {
  local i clear=0
  for i in $(seq 1 3000); do
    if ! compgen -G "node_modules/.vlt/.VLT.DELETE.*" >/dev/null &&
      ! vlt_background_running; then
      clear=$((clear + 1))
      if [ "$clear" -ge 2 ]; then
        return 0
      fi
    else
      clear=0
    fi
    sleep 0.1
  done
  echo "[add-remove] vlt background work still running after 300s"
  return 1
}

sync_tree() {
  local rc=0
  rsync -aH --delete --exclude='.VLT.DELETE.*' "$1" "$2" || rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 24 ]; then
    return "$rc"
  fi
}

# Global cache directories per PM, mirroring clean-helpers.sh. Both the XDG
# and the default locations are listed, since which one a PM uses depends on
# whether XDG_* is set. A directory that doesn't exist at snapshot time is
# still recorded, so one the timed add creates is removed on restore.
pm_cache_dirs() {
  local cache="${XDG_CACHE_HOME:-$HOME/.cache}"
  local data="${XDG_DATA_HOME:-$HOME/.local/share}"
  case "$1" in
    npm) printf '%s\n' "${npm_config_cache:-$HOME/.npm}" "$cache/npm" ;;
    yarn) printf '%s\n' "$cache/yarn" ;;
    berry) printf '%s\n' "$data/yarn" "$HOME/.yarn/berry" ;;
    zpm) printf '%s\n' "$HOME/.yarn/zpm" ;;
    pnpm) printf '%s\n' "$data/pnpm" "$cache/pnpm" ;;
    vlt) printf '%s\n' "$cache/vlt" ;;
    bun) printf '%s\n' "${BUN_INSTALL_CACHE_DIR:-$HOME/.bun/install/cache}" "$cache/.bun/install" ;;
    deno) printf '%s\n' "${DENO_DIR:-$cache/deno}" ;;
    aube) printf '%s\n' "$data/aube" "$cache/aube" "$HOME/.aube-store" ;;
    upm) printf '%s\n' "$HOME/.upm" "$data/upm" "$cache/upm" ;;
  esac
}

snapshot_caches() {
  local i=0 dir
  mkdir -p "$cache_snapshot"
  : > "$cache_snapshot/dirs"
  while IFS= read -r dir; do
    i=$((i + 1))
    if [ -d "$dir" ]; then
      mkdir -p "$cache_snapshot/$i"
      sync_tree "$dir/" "$cache_snapshot/$i/"
    fi
    printf '%s\t%s\n' "$i" "$dir" >> "$cache_snapshot/dirs"
  done < <(pm_cache_dirs "$pm" | awk '!seen[$0]++')
}

restore_caches() {
  local i dir
  [ -f "$cache_snapshot/dirs" ] || return 0
  while IFS=$'\t' read -r i dir; do
    [ -n "$dir" ] || continue
    if [ -d "$cache_snapshot/$i" ]; then
      mkdir -p "$dir"
      sync_tree "$cache_snapshot/$i/" "$dir/"
    else
      rm -rf "$dir"
    fi
  done < "$cache_snapshot/dirs"
}

if [ -f "$state_dir/pm" ] && [ "$(cat "$state_dir/pm")" = "$pm-$mode" ] && [ -f "$state_dir/failed" ]; then
  # The baseline (or a wait for background work) failed: nothing to restore,
  # the timed command will fail.
  exit 0
fi

if [ -f "$state_dir/pm" ] && [ "$(cat "$state_dir/pm")" = "$pm-$mode" ] && [ -d "$snapshot" ]; then
  # Restore the exact baseline. -H keeps hard links (pnpm/bun), -a keeps
  # symlinks (aube, pnpm virtual store), --delete drops anything the timed
  # command created (e.g. node_modules/<new-pkg>).
  if ! wait_for_pm_background; then
    echo "background" > "$state_dir/failed"
    exit 0
  fi
  sync_tree "$snapshot/" ./
  if [ "$mode" = "add" ]; then
    restore_caches
  fi
  exit 0
fi

# New package manager: build its baseline from scratch.
rm -rf "$state_dir"
bash "$SCRIPTS_DIR/clean-helpers.sh" \
  clean_node_modules clean_lockfiles clean_package_manager_files \
  clean_workspace_protocol clean_package_manager_field clean_build_files
# Workspace packages can carry their own node_modules (babylon).
if [ -d packages ]; then
  find packages -name node_modules -type d -prune -exec rm -rf {} + 2>/dev/null || true
fi

if [ -n "${!setup_var:-}" ]; then
  eval "${!setup_var}"
fi
mkdir -p "$state_dir"
echo "$pm-$mode" > "$state_dir/pm"
baseline_log="$BENCH_OUTPUT_FOLDER/$pm-baseline.log"

echo "[add-remove] baseline install for $pm: ${!install_var}"
if ! ( eval "${!install_var}" ) >>"$baseline_log" 2>&1; then
  echo "[add-remove] baseline install for $pm failed, see $baseline_log"
  echo "install" > "$state_dir/failed"
  exit 0
fi

if [ "$mode" = "remove" ]; then
  echo "[add-remove] adding package under test for $pm: ${!add_var}"
  if ! ( eval "${!add_var}" ) >>"$baseline_log" 2>&1; then
    echo "[add-remove] baseline add for $pm failed, see $baseline_log"
    echo "add" > "$state_dir/failed"
    exit 0
  fi
fi

if ! wait_for_pm_background; then
  echo "background" > "$state_dir/failed"
  exit 0
fi
mkdir -p "$snapshot"
sync_tree ./ "$snapshot/"
if [ "$mode" = "add" ]; then
  snapshot_caches
fi
