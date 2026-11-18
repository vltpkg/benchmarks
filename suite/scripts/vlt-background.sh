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
vlt_background_running() {
  pgrep -u "$(id -u)" '^vlt-' >/dev/null ||
    pgrep -u "$(id -u)" -f '/vlt/[a-z-]+-src-[a-z-]+[.]js' >/dev/null
}
