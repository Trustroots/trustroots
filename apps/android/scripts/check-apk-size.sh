#!/usr/bin/env bash
set -euo pipefail

apk="${1:?Pass the release APK path}"
budget_bytes=5000000

if [[ ! -s "$apk" ]]; then
  echo "::error::Missing or empty release APK: $apk"
  exit 1
fi

size_bytes=$(wc -c < "$apk")
printf -v report 'Release APK size: %d bytes (budget: %d bytes)' "$size_bytes" "$budget_bytes"

if [[ $# -ge 2 ]]; then
  baseline_apk="$2"
  if [[ ! -s "$baseline_apk" ]]; then
    echo "::error::Missing or empty main release APK: $baseline_apk"
    exit 1
  fi

  baseline_bytes=$(wc -c < "$baseline_apk")
  delta_bytes=$((size_bytes - baseline_bytes))
  if (( delta_bytes == 0 )); then
    report+=" · unchanged from main"
  else
    printf -v comparison ' · %+d bytes vs main (%d bytes)' "$delta_bytes" "$baseline_bytes"
    report+="$comparison"
  fi
fi

echo "$report"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "$report" >> "$GITHUB_STEP_SUMMARY"
fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "report=$report" >> "$GITHUB_OUTPUT"
fi

if (( size_bytes > budget_bytes )); then
  echo "::error::$report. Reduce APK size or review the budget in apps/android/scripts/check-apk-size.sh."
  exit 1
fi
