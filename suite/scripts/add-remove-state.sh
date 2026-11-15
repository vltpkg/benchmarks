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
#     The resulting fixture directory is snapshotted to <state-dir>.
#   - Every later run for <pm>: rsync the snapshot back over the fixture with
#     --delete, undoing whatever the previous timed add/remove changed
#     (package.json, lockfile, node_modules, PM state files).
#
# Caches are never cleaned here: the variation is "warm project", matching
# cache+lockfile+node_modules. The variation script cleans all caches once
# before the first PM and after the last, like every other variation.
#
# Commands are read from the environment (exported by add-remove.sh):
#   BENCH_SETUP_<PM>, BENCH_INSTALL_<PM>, BENCH_ADD_<PM>
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

# vlt removes replaced store entries asynchronously: it renames them to
# node_modules/.vlt/.VLT.DELETE.* and deletes them in a detached process that
# can outlive the vlt command. rsync racing that deletion fails with exit 24
# ("some files vanished"). Wait for the trash to drain, never copy it, and
# treat a vanished-file warning as success.
wait_for_pm_trash() {
  local i
  for i in $(seq 1 100); do
    if ! compgen -G "node_modules/.vlt/.VLT.DELETE.*" >/dev/null; then
      return 0
    fi
    sleep 0.1
  done
}

sync_tree() {
  local rc=0
  rsync -aH --delete --exclude='.VLT.DELETE.*' "$1" "$2" || rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 24 ]; then
    return "$rc"
  fi
}

if [ -f "$state_dir/pm" ] && [ "$(cat "$state_dir/pm")" = "$pm-$mode" ] && [ -d "$snapshot" ]; then
  # Restore the exact baseline. -H keeps hard links (pnpm/bun), -a keeps
  # symlinks (aube, pnpm virtual store), --delete drops anything the timed
  # command created (e.g. node_modules/<new-pkg>).
  wait_for_pm_trash
  sync_tree "$snapshot/" ./
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
echo "[add-remove] baseline install for $pm: ${!install_var}"
eval "${!install_var}" >/dev/null 2>&1 || echo "[add-remove] warning: baseline install for $pm exited non-zero"

if [ "$mode" = "remove" ]; then
  echo "[add-remove] adding package under test for $pm: ${!add_var}"
  eval "${!add_var}" >/dev/null 2>&1 || echo "[add-remove] warning: baseline add for $pm exited non-zero"
fi

wait_for_pm_trash
mkdir -p "$snapshot"
sync_tree ./ "$snapshot/"
echo "$pm-$mode" > "$state_dir/pm"
