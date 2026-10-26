#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo 'Usage: run-with-android-boot-health.sh <diagnostics-directory> <command> [arguments...]' >&2
  exit 2
fi

diagnostics=$1
shift
diagnostics_runner="$(dirname "$0")/run-with-device-diagnostics.sh"

device_anr_report() {
  local last_anr windows
  last_anr=$(timeout 5 adb shell dumpsys activity lastanr 2>&1) || return 1
  windows=$(timeout 5 adb shell dumpsys window windows 2>&1) || return 1
  grep -q 'ACTIVITY MANAGER LAST ANR' <<< "$last_anr" || return 1
  grep -q 'WINDOW MANAGER WINDOWS' <<< "$windows" || return 1
  # Healthy fresh emulators may omit mCurrentFocus from this dump. Validate
  # the windows section itself; focus is not required to inspect ANR dialogs.
  grep -Eq '^[[:space:]]*Window #[0-9]+ Window\{' <<< "$windows" || return 1
  printf '%s\n%s\n' "$last_anr" "$windows"
}

anr_kind() {
  local report=$1 anr_lines unexpected_lines
  anr_lines=$(grep -E 'ANR in |Application Not Responding:' <<< "$report" || true)
  [[ -n "$anr_lines" ]] || { printf 'clean\n'; return; }

  # A mixed report must never be treated as recoverable merely because it also
  # mentions System UI or the launcher. Reboot only when every ANR line belongs
  # to one of those boot-time system processes.
  unexpected_lines=$(grep -Ev 'ANR in .*com\.android\.(systemui|launcher3)([[:space:]}:]|$)|Application Not Responding: com\.android\.(systemui|launcher3)([[:space:]}:]|$)' <<< "$anr_lines" || true)
  if [[ -n "$unexpected_lines" ]]; then
    printf 'unexpected\n'
  else
    printf 'boot-ui\n'
  fi
}

check_stable_health() {
  local report kind
  for _ in {1..5}; do
    report=$(device_anr_report) || return 2
    kind=$(anr_kind "$report")
    [[ "$kind" == unexpected ]] && return 3
    [[ "$kind" == boot-ui ]] && return 1
    sleep 2
  done
}

fail_with_diagnostics() {
  local status=$1
  shift
  printf '%s\n' "$*" >&2
  bash "$diagnostics_runner" "$diagnostics" false || true
  exit "$status"
}

if check_stable_health; then
  health=clean
else
  health_status=$?
  case "$health_status" in
    1) health=boot-ui ;;
    2) fail_with_diagnostics 1 'Could not read emulator ANR or window state before instrumentation.' ;;
    3) fail_with_diagnostics 1 'An unexpected ANR is present before instrumentation; refusing to reboot or mask it.' ;;
    *) fail_with_diagnostics 1 'Emulator health check failed before instrumentation.' ;;
  esac
fi

if [[ "$health" == boot-ui ]]; then
  echo 'A boot-time Android System UI or launcher ANR was detected; rebooting the emulator once before tests.' >&2
  timeout 30 adb reboot || fail_with_diagnostics 1 'Could not request the one permitted emulator reboot.'
  timeout 60 adb wait-for-device || fail_with_diagnostics 1 'The emulator did not reconnect after reboot.'

  booted=false
  for _ in {1..60}; do
    boot_completed=$(timeout 5 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') || fail_with_diagnostics 1 'Could not read emulator boot state after recovery.'
    if [[ "$boot_completed" == 1 ]]; then
      booted=true
      break
    fi
    sleep 2
  done
  [[ "$booted" == true ]] || fail_with_diagnostics 1 'The emulator did not finish booting after its one recovery reboot.'

  # A reboot resets these device settings. Reapply the test environment before
  # checking that the launcher and System UI remain responsive.
  timeout 10 adb shell settings put system screen_off_timeout 2147483647 || fail_with_diagnostics 1 'Could not keep the emulator awake after recovery.'
  timeout 10 adb shell svc power stayon true || fail_with_diagnostics 1 'Could not keep emulator power on after recovery.'
  timeout 10 adb shell input keyevent KEYCODE_WAKEUP || fail_with_diagnostics 1 'Could not wake the emulator after recovery.'
  timeout 10 adb shell wm dismiss-keyguard || fail_with_diagnostics 1 'Could not dismiss the emulator keyguard after recovery.'
  timeout 10 adb shell settings put secure show_ime_with_hard_keyboard 1 || fail_with_diagnostics 1 'Could not restore the software keyboard setting after recovery.'

  if check_stable_health; then
    :
  else
    health_status=$?
    case "$health_status" in
      1) fail_with_diagnostics 1 'The System UI or launcher ANR returned after the single recovery reboot.' ;;
      2) fail_with_diagnostics 1 'Could not read emulator ANR or window state after recovery.' ;;
      3) fail_with_diagnostics 1 'An unexpected ANR is present after recovery; refusing another reboot.' ;;
      *) fail_with_diagnostics 1 'The emulator did not remain healthy for the recovery window.' ;;
    esac
  fi
fi

bash "$diagnostics_runner" "$diagnostics" "$@"
