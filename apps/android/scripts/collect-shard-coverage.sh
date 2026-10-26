#!/usr/bin/env bash
set -euo pipefail

# Run one API 36 shard from the shared coverage APKs with clean app data.
# Rebuilding here would change the classes whose probes JaCoCo needs to merge.
if [[ $# != 1 || ! "$1" =~ ^[01]$ ]]; then
  echo 'Usage: collect-shard-coverage.sh <shard-index: 0 or 1>' >&2
  exit 2
fi
shard=$1
android_root=$(cd "$(dirname "$0")/.." && pwd)
adb_command=${ADB:-adb}
serial=${ANDROID_SERIAL:-$("$adb_command" get-serialno)}
if [[ "$serial" != emulator-* ]]; then
  echo 'Shard coverage requires a dedicated Android emulator.' >&2
  exit 1
fi
sdk=$("$adb_command" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')
if [[ "$sdk" != 36 ]]; then
  echo "Shard coverage requires API 36; found $sdk." >&2
  exit 1
fi

app_package=org.trustroots.android.debug
test_package=org.trustroots.android.debug.test
app_apk="$android_root/app/build/outputs/apk/debug/app-debug.apk"
test_apk="$android_root/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
for apk in "$app_apk" "$test_apk"; do
  test -s "$apk" || { echo "Missing previously built APK: $apk" >&2; exit 1; }
done

# Instrumentation coverage needs a cold app start even when this AVD was used
# before. pm list packages returns an empty successful result when the package
# is absent, unlike pm path. Match exact package lines because the test APK's
# package name also contains the debug app package name.
if ! installed_packages=$("$adb_command" -s "$serial" shell pm list packages --user 0 "$app_package"); then
  echo "Could not check whether $app_package is installed." >&2
  exit 1
fi
app_installed=false
while IFS= read -r installed_package; do
  installed_package=${installed_package%$'\r'}
  [[ -z "$installed_package" ]] && continue
  case "$installed_package" in
    "package:$app_package") app_installed=true ;;
    "package:$test_package") ;;
    *)
      echo "Unexpected response while checking whether $app_package is installed: $installed_package" >&2
      exit 1
      ;;
  esac
done <<< "$installed_packages"
if [[ "$app_installed" == true ]]; then
  "$adb_command" -s "$serial" uninstall "$app_package"
fi

output_dir="$android_root/app/build/outputs/code_coverage/debugAndroidTest/connected/api36-$shard"
mkdir -p "$output_dir"
rm -f "$output_dir/coverage.ec"
log_file="$output_dir/instrumentation.log"

"$adb_command" -s "$serial" install -r "$app_apk"
"$adb_command" -s "$serial" install -r "$test_apk"
"$adb_command" -s "$serial" shell run-as "$app_package" mkdir -p files
"$adb_command" -s "$serial" shell run-as "$app_package" rm -f files/api36-coverage.ec

"$adb_command" -s "$serial" shell am instrument -w -r \
  -e coverage true \
  -e coverageFile "/data/user/0/$app_package/files/api36-coverage.ec" \
  -e numShards 2 -e shardIndex "$shard" \
  "$test_package/androidx.test.runner.AndroidJUnitRunner" | tee "$log_file"

# am instrument can return shell success even when tests fail or none were found.
python3 - "$log_file" <<'PY'
from pathlib import Path
import re
import sys

log = Path(sys.argv[1]).read_text()
if "INSTRUMENTATION_CODE: -1" not in log or not re.search(r"\bOK \([1-9][0-9]* tests?\)", log):
    raise SystemExit("The API 36 shard must run tests successfully before exporting coverage.")
if re.search(r"INSTRUMENTATION_STATUS_CODE: -[12]\b|FAILURES!!!|Failed to generate .*coverage", log):
    raise SystemExit("API 36 instrumentation reported a failure.")
PY

"$adb_command" -s "$serial" exec-out run-as "$app_package" \
  cat files/api36-coverage.ec > "$output_dir/coverage.ec"
test -s "$output_dir/coverage.ec"
echo "Collected API 36 shard $shard coverage from the existing APKs: $output_dir/coverage.ec"
