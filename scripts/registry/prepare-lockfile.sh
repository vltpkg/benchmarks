# A failing prepare hook stops hyperfine even when --ignore-failure is enabled.
set -Eeuo pipefail

scripts=$1
output=$2
registry=$3
registry_url=$4
setup=$5
install=$6
warmups=$7
warmup_timeout=$8
snapshot="$output/$registry-package-lock.json"
stage="lockfile preparation"

report_failure() {
  local status=$?
  local message="$registry registry-lockfile: $stage failed (exit $status). Timed runs stopped; see $registry-prepare.log and $registry-warmup-*.log."
  printf '%s\n' "$message" | tee "$output/$registry-failure.log" >&2
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '\n### Registry lockfile failure\n\n%s\n' "$message" >> "$GITHUB_STEP_SUMMARY"
  fi
  exit "$status"
}
trap report_failure ERR

prepare() {
  sleep 1
  # Corepack cache cleans can re-pin devEngines.packageManager, so remove it last.
  bash "$scripts/clean-helpers.sh" clean_all_cache clean_package_manager_field clean_node_modules clean_package_manager_files clean_npmrc
  bash -c "$setup"
  test "$(npm config get registry)" = "$registry_url"
}

if [ ! -f "$snapshot" ]; then
  # Never accept a fixture lockfile or a previous registry's lockfile as warmup.
  bash "$scripts/clean-helpers.sh" clean_all clean_npmrc
  if [[ ! "$warmups" =~ ^[0-9]+$ ]]; then
    stage="invalid BENCH_WARMUP=$warmups"
    false
  fi
  # Even --warmup=0 must resolve a graph before any lockfile timing begins.
  if [ "$warmups" -eq 0 ]; then warmups=1; fi
  for ((iteration=0; iteration<warmups; iteration++)); do
    stage="warmup $iteration preparation"
    prepare
    stage="warmup $iteration (timeout ${warmup_timeout}s)"
    timeout "$warmup_timeout" bash -c "$install" > "$output/$registry-warmup-$iteration.log" 2>&1
    stage="warmup $iteration lockfile validation"
    node "$scripts/registry/validate-lockfile.js"
  done
  cp package-lock.json "$snapshot"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '\n- %s registry-lockfile: %s warmup(s) succeeded (timeout %ss); lockfile validated.\n' "$registry" "$warmups" "$warmup_timeout" >> "$GITHUB_STEP_SUMMARY"
  fi
fi

stage="timed-run lockfile validation"
prepare
# The immutable, registry-specific snapshot also detects a lockfile replaced or
# modified between runs. No validation or preparation is included in the timing.
cmp package-lock.json "$snapshot"
