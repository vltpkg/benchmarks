#!/usr/bin/env bash
# Counts spawned processes during a package manager install using strace.
#
# Usage:
#   bash process-count.sh <output-folder> <pm-name> <install-command> [prepare-command]
#
# Runs a single install wrapped in `strace -f -e trace=execve` and counts
# the number of execve() calls. The raw count is appended to
# <output-folder>/<pm-name>-process-count.txt (one number per line, matching
# the pattern used by package-count.sh).
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

# Run optional prepare step (e.g. clean + setup)
if [ -n "$PREPARE_CMD" ]; then
  echo "[process-count] Running prepare for $PM_NAME..."
  eval "$PREPARE_CMD" || true
fi

# Run the install command under strace
echo "[process-count] Running strace'd install for $PM_NAME..."
strace -f -e trace=execve -o "$STRACE_LOG" \
  bash -c "$INSTALL_CMD" > /dev/null 2>&1 || true

# Count execve calls (each line with 'execve(' is one spawned process)
if [ -f "$STRACE_LOG" ]; then
  COUNT=$(grep -c 'execve(' "$STRACE_LOG" 2>/dev/null || echo "0")
  echo "$COUNT" >> "$PROCESS_COUNT_FILE"
  echo "[process-count] $PM_NAME spawned $COUNT processes"

  # Remove strace log to save space (can be large)
  rm -f "$STRACE_LOG"
else
  echo "Warning: strace log not found for $PM_NAME"
fi
