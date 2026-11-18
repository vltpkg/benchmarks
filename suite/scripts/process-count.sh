#!/usr/bin/env bash
# Counts spawned processes during a package manager install using strace.
#
# Usage:
#   bash process-count.sh <output-folder> <pm-name> <install-command> [prepare-command]
#
# Runs a single install wrapped in `strace -f -e trace=execve,execveat` and counts the
# processes it started (see count-processes.js for what counts). The count is
# appended to <output-folder>/<pm-name>-process-count.txt (one number per
# line, matching the pattern used by package-count.sh). Nothing is recorded if
# the install fails: a failed command's processes aren't the ones the timed
# runs measure.
#
# This script is meant to run OUTSIDE the timed benchmark (strace adds
# overhead). It is invoked by `collect_process_count` in common.sh after
# the hyperfine run completes.

set -Eeuo pipefail

if [ -z "${1:-}" ]; then
  echo "Error: output folder is required"
  exit 1
fi
OUTPUT_FOLDER="$1"

if [ -z "${2:-}" ]; then
  echo "Error: package manager name is required"
  exit 1
fi
PM_NAME="$2"

if [ -z "${3:-}" ]; then
  echo "Error: install command is required"
  exit 1
fi
INSTALL_CMD="$3"

PREPARE_CMD="${4:-}"

STRACE_LOG="$OUTPUT_FOLDER/${PM_NAME}-strace.log"
PROCESS_COUNT_FILE="$OUTPUT_FOLDER/${PM_NAME}-process-count.txt"

# Ensure strace is available
if ! command -v strace &>/dev/null; then
  echo "Warning: strace not found, skipping process count for $PM_NAME"
  exit 0
fi

# Run optional prepare step (e.g. clean + setup). Like the timed runs, wait
# for vlt's background work before and after it, so it can't overlap the
# counted install (see hyperfine-wait.sh).
WAIT_CMD="bash $(dirname "$0")/clean-helpers.sh wait_for_vlt_background"
if [ -n "$PREPARE_CMD" ]; then
  echo "[process-count] Running prepare for $PM_NAME..."
  $WAIT_CMD
  eval "$PREPARE_CMD" || true
  $WAIT_CMD
fi

# Run the install command under strace. The timeout wraps strace, not the
# command: `strace -f` waits for every traced process, detached ones included,
# so a stuck background child would otherwise hang the counting pass. strace
# ignores SIGTERM while it has tracees, hence -k. A timed-out run exits 124 or
# 137 and is skipped like any other failure.
echo "[process-count] Running strace'd install for $PM_NAME..."
EXIT_CODE=0
timeout -k 10 "${BENCH_TIMEOUT:-300}" \
  strace -f -e trace=execve,execveat -o "$STRACE_LOG" \
  bash -c "$INSTALL_CMD" > /dev/null 2>&1 || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
  # strace passes the command's exit status through, but exits non-zero on its
  # own if it can't trace (e.g. no ptrace permission), so name both.
  echo "Warning: strace'd install exited with $EXIT_CODE for $PM_NAME, skipping process count"
elif [ ! -f "$STRACE_LOG" ]; then
  echo "Warning: strace log not found for $PM_NAME"
elif ! COUNT=$(node "$(dirname "$0")/count-processes.js" "$STRACE_LOG"); then
  echo "Warning: could not count processes from the strace log for $PM_NAME, skipping process count"
else
  echo "$COUNT" >> "$PROCESS_COUNT_FILE"
  echo "[process-count] $PM_NAME started $COUNT processes"
fi

# Remove strace log to save space (can be large)
rm -f "$STRACE_LOG"
