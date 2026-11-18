# Sourced by clean-helpers.sh and add-remove-state.sh.
#
# vlt finishes work in detached child processes that outlive the vlt command.
# vlt 1.8.0 has five, each a `node .../vlt/<name>-src-<name>.js` script:
#
#   cache-unzip-src-unzip.js               unpacks fetched tarballs into the
#                                          cache (renames itself vlt-cache-unzip)
#   registry-client-src-revalidate.js      revalidates cached manifests
#                                          (vlt-cache-revalidate)
#   rollback-remove-src-remove.js          deletes node_modules/.vlt/.VLT.DELETE.*
#                                          (keeps its command line)
#   security-archive-src-update-expired.js (vlt-security-archive-update)
#   cli-sdk-src-update-check.js            (vlt-update-check)
#
# Match the renamed ones by process name (Linux truncates it to 15
# characters, e.g. "vlt-cache-reval", so match the vlt- prefix), and every one
# by its original command line, which covers rollback-remove and the moment
# before a child renames itself. Matching the name, not the command line, for
# the first check means a shell whose arguments mention these names can never
# match itself; the [.] does the same for the second.
#
# Those two checks match every vlt child of the current user. On a shared
# machine that includes other benchmark checkouts and the user's own vlt
# commands, which a run would then wait on, or stop. So each run exports a
# unique BENCH_RUN_ID (variations/common.sh, registry/common.sh); every
# process the run starts inherits it, and vlt passes `process.env` on to its
# detached children, so they carry it too. When BENCH_RUN_ID is set, only
# processes whose environment holds this run's id count. When it is unset (a
# script run by hand), every vlt child of the user counts, as before.

# vlt_background_pids: the pids of vlt's detached children of this run, one
# per line (none: empty output). Never fails.
vlt_background_pids() {
  local pids pid
  pids=$({
    pgrep -u "$(id -u)" '^vlt-'
    pgrep -u "$(id -u)" -f '/vlt/[a-z-]+-src-[a-z-]+[.]js'
  } | sort -un) || true
  if [ -z "${BENCH_RUN_ID:-}" ]; then
    [ -z "$pids" ] || printf '%s\n' "$pids"
    return 0
  fi
  for pid in $pids; do
    # The process may have exited since pgrep, and environ may be unreadable
    # (not our process after all): a process whose id can't be read isn't
    # treated as ours.
    if tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null |
      grep -qxF -- "BENCH_RUN_ID=$BENCH_RUN_ID"; then
      printf '%s\n' "$pid"
    fi
  done
  return 0
}

# vlt_background_running: whether any of vlt's detached children of this run
# is running.
vlt_background_running() {
  [ -n "$(vlt_background_pids)" ]
}
