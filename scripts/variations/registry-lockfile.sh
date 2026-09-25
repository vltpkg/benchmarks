# Exit on error
set -Eeuxo pipefail

source "$1/registry/common.sh"

# Resolution can take 300–380s on slower registries. Give untimed warmups a
# separate budget; timed tarball installs keep BENCH_TIMEOUT (300s by default).
BENCH_WARMUP_TIMEOUT="${BENCH_WARMUP_TIMEOUT:-600}"
BENCH_COMMAND_ARGS=()
for registry in npm vlt aws cloudsmith github jfrog; do
  key=$(printf '%s' "$registry" | tr '[:lower:]' '[:upper:]')
  include_var="BENCH_INCLUDE_REG_$key"
  if [ -z "${!include_var}" ]; then continue; fi
  setup_var="BENCH_SETUP_REGISTRY_$key"
  url_var="BENCH_REGISTRY_${key}_URL"
  command_var="BENCH_COMMAND_$key"
  conclude_var="BENCH_CONCLUDE_$key"
  if [ "$registry" = vlt ]; then
    command_var=BENCH_COMMAND_VLT_REG
    conclude_var=BENCH_CONCLUDE_VLT_REG
  fi
  printf -v prepare 'bash %q %q %q %q %q %q %q %q %q >> %q 2>&1' \
    "$BENCH_SCRIPTS/registry/prepare-lockfile.sh" "$BENCH_SCRIPTS" \
    "$BENCH_OUTPUT_FOLDER" "$registry" "${!url_var}" "${!setup_var}" \
    "$BENCH_NPM_INSTALL" "$BENCH_WARMUP" "$BENCH_WARMUP_TIMEOUT" \
    "$BENCH_OUTPUT_FOLDER/$registry-prepare.log"
  BENCH_COMMAND_ARGS+=(--prepare="$prepare" --command-name="$registry" \
    "${!command_var}" --conclude="${!conclude_var}")
done

# Warmups run in a checked prepare hook: --ignore-failure only applies to timed
# installs. Every prepare verifies the lockfile produced for this registry.
echo "Hyperfine version: $(hyperfine --version)"
if hyperfine --ignore-failure \
  --time-unit=millisecond \
  --export-json="$BENCH_OUTPUT_FOLDER/benchmarks.json" \
  --warmup=0 \
  --runs="$BENCH_RUNS" \
  --cleanup="bash $BENCH_SCRIPTS/clean-helpers.sh clean_all clean_npmrc" \
  "${BENCH_COMMAND_ARGS[@]}"; then
  collect_registry_package_count
else
  status=$?
  for failure in "$BENCH_OUTPUT_FOLDER"/*-failure.log; do
    if [ -f "$failure" ]; then cat "$failure" >&2; fi
  done
  exit "$status"
fi
