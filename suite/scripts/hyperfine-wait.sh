# Sourced by variations/common.sh and registry/common.sh.
#
# Wraps hyperfine so vlt's background cache unpacking (see
# wait_for_vlt_background in clean-helpers.sh) can't spill into the next run.
# Every --setup and --cleanup waits for it first, and every --prepare waits
# both first (before it cleans caches) and last, right before the timed
# command, because several prepares run an install of their own. All of it is
# untimed. A --prepare keeps its own exit status, so a failing prepare still
# stops hyperfine as before.
hyperfine() {
  local wait="bash $BENCH_SCRIPTS/clean-helpers.sh wait_for_vlt_background"
  local args=() arg
  for arg in "$@"; do
    case "$arg" in
      --prepare=*)
        # The newline ends the prepare even if it ends in `;`, and $? is then
        # its status.
        args+=("--prepare=$wait; ${arg#--prepare=}
bench_prepare_rc=\$?; $wait; exit \$bench_prepare_rc")
        ;;
      --setup=*) args+=("--setup=$wait; ${arg#--setup=}") ;;
      --cleanup=*) args+=("--cleanup=$wait; ${arg#--cleanup=}") ;;
      *) args+=("$arg") ;;
    esac
  done
  command hyperfine "${args[@]}"
}
