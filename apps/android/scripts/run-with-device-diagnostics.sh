#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo 'Usage: run-with-device-diagnostics.sh <diagnostics-directory> <command> [arguments...]' >&2
  exit 2
fi

diagnostics=$1
shift
if "$@"; then
  exit 0
else
  status=$?
fi

mkdir -p "$diagnostics" || exit "$status"
adb logcat -d -v threadtime > "$diagnostics/logcat.txt" 2>&1 || true
adb shell dumpsys window windows > "$diagnostics/window.txt" 2>&1 || true
adb shell dumpsys activity activities > "$diagnostics/activities.txt" 2>&1 || true
adb shell dumpsys activity lastanr > "$diagnostics/last-anr.txt" 2>&1 || true
exit "$status"
