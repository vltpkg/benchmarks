#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WORKFLOW_FILE="benchmark.yaml"
BRANCH="main"
RUN_ID=""
REPO=""
KEEP_EXISTING=0

RESULTS_DIR="$ROOT/results"
VERSIONS_DIR="$ROOT/versions-temp"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/download-latest-artifacts.sh [options]

Downloads benchmark artifacts from the latest successful workflow run.

Options:
  --run-id <id>      Download artifacts from a specific run id
  --branch <name>    Branch to search for runs (default: main)
  --workflow <file>  Workflow file/name to search (default: benchmark.yaml)
  --repo <owner/repo>
                     Repository to query (default: current repository)
  --keep-existing    Do not delete existing downloaded artifact directories
  --help             Show this help

Examples:
  ./scripts/download-latest-artifacts.sh
  ./scripts/download-latest-artifacts.sh --branch lk/cleanup
  ./scripts/download-latest-artifacts.sh --run-id 12345678901
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: Missing required command '$cmd'"
    exit 1
  fi
}

remove_matching_dirs() {
  local base="$1"
  local prefix="$2"
  local matches=()

  shopt -s nullglob
  matches=("$base"/"$prefix"-*)
  shopt -u nullglob

  if [[ ${#matches[@]} -gt 0 ]]; then
    rm -rf "${matches[@]}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --run-id=*)
      RUN_ID="${1#*=}"
      shift
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --branch=*)
      BRANCH="${1#*=}"
      shift
      ;;
    --workflow)
      WORKFLOW_FILE="${2:-}"
      shift 2
      ;;
    --workflow=*)
      WORKFLOW_FILE="${1#*=}"
      shift
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --repo=*)
      REPO="${1#*=}"
      shift
      ;;
    --keep-existing)
      KEEP_EXISTING=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$1'"
      usage
      exit 1
      ;;
  esac
done

require_cmd gh

GH_REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  GH_REPO_ARGS=(-R "$REPO")
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run 'gh auth login' first."
  exit 1
fi

if [[ -z "$RUN_ID" ]]; then
  run_line="$(
    gh run list "${GH_REPO_ARGS[@]}" \
      --workflow "$WORKFLOW_FILE" \
      --branch "$BRANCH" \
      --limit 50 \
      --json databaseId,createdAt,status,conclusion \
      --jq 'map(select(.status == "completed" and .conclusion == "success")) | if length == 0 then empty else .[0] | "\(.databaseId)\t\(.createdAt)" end'
  )"

  if [[ -z "$run_line" ]]; then
    echo "Error: No successful completed runs found for '$WORKFLOW_FILE' on branch '$BRANCH'."
    exit 1
  fi

  IFS=$'\t' read -r RUN_ID RUN_CREATED_AT <<< "$run_line"
else
  RUN_CREATED_AT="$(
    gh run view "$RUN_ID" "${GH_REPO_ARGS[@]}" \
      --json createdAt \
      --jq '.createdAt'
  )"
fi

if [[ -z "${RUN_CREATED_AT:-}" || "$RUN_CREATED_AT" == "null" ]]; then
  echo "Error: Could not resolve run timestamp for run id '$RUN_ID'."
  exit 1
fi

RUN_DAY="${RUN_CREATED_AT%%T*}"

mkdir -p "$RESULTS_DIR" "$VERSIONS_DIR"

if [[ "$KEEP_EXISTING" -eq 0 ]]; then
  remove_matching_dirs "$RESULTS_DIR" "results"
  remove_matching_dirs "$VERSIONS_DIR" "versions"
fi

echo "Using run id: $RUN_ID"
echo "Run created at (UTC): $RUN_CREATED_AT"
echo "Run day (UTC): $RUN_DAY"
echo

echo "Downloading results-* artifacts..."
gh run download "$RUN_ID" "${GH_REPO_ARGS[@]}" --pattern 'results-*' --dir "$RESULTS_DIR"

echo "Downloading versions-* artifacts..."
gh run download "$RUN_ID" "${GH_REPO_ARGS[@]}" --pattern 'versions-*' --dir "$VERSIONS_DIR"

echo
echo "Artifacts downloaded."
echo "Next step:"
echo "  1) Process downloaded artifacts:"
echo "     ./bench process"
echo
echo "  2) Copy chart data for the web app:"
echo "     mkdir -p app/latest"
echo "     cp results/latest/chart-data.json app/latest/chart-data.json"
echo
echo "  3) Run the app locally:"
echo "     cd app"
echo "     vlt install || npm install"
echo "     npm run dev"
