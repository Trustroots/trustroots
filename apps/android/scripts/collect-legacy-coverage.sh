#!/usr/bin/env bash
set -euo pipefail

# Run API 32 compatibility journeys from APKs tested on API 36 with clean app data.
# Rebuilding here would change the classes whose probes JaCoCo needs to merge.
android_root=$(cd "$(dirname "$0")/.." && pwd)
adb_command=${ADB:-adb}
serial=${ANDROID_SERIAL:-$("$adb_command" get-serialno)}
if [[ "$serial" != emulator-* ]]; then
  echo 'Legacy coverage requires a dedicated Android emulator.' >&2
  exit 1
fi
sdk=$("$adb_command" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')
if [[ "$sdk" != 32 ]]; then
  echo "Legacy coverage requires API 32; found $sdk." >&2
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

output_dir="$android_root/app/build/outputs/code_coverage/debugAndroidTest/connected/api32"
mkdir -p "$output_dir"
rm -f "$output_dir/coverage.ec"
log_file="$output_dir/instrumentation.log"

"$adb_command" -s "$serial" install -r "$app_apk"
"$adb_command" -s "$serial" install -r "$test_apk"
"$adb_command" -s "$serial" shell run-as "$app_package" mkdir -p files
"$adb_command" -s "$serial" shell run-as "$app_package" rm -f files/api32-coverage.ec
test_classes='org.trustroots.android.notifications.SdkNotificationCompatibilityJourneyTest,org.trustroots.android.browser.EmbeddedBrowserStyleTest#legacyStylingOnlyRunsForTrustrootsPagesWithoutDocumentStartSupport,org.trustroots.android.browser.BrowserNavigationJourneyTest#externalNavigationRequiresConfirmationAndCanBeCancelled,org.trustroots.android.ui.AccountPreviewUpdateAlertsJourneyTest#memberCanEnableCheckRetryOpenAndDisablePreviewUpdatesOffline,org.trustroots.android.api.SecureMobileSessionStoreTest#savesAndLoadsTheCurrentMemberSessionWithoutPlaintextPreferences,org.trustroots.android.api.OfflineCacheJourneyTest#cacheEvictsOnlyTheRequestedCategoriesAndRejectsOversizedSnapshots,org.trustroots.android.ui.AccountMessagePermissionGrantedJourneyTest#grantedMessagePermissionStartsEnableWithTheCurrentActivityAndSession'

"$adb_command" -s "$serial" shell am instrument -w -r \
  -e coverage true \
  -e coverageFile "/data/user/0/$app_package/files/api32-coverage.ec" \
  -e class "$test_classes" \
  "$test_package/androidx.test.runner.AndroidJUnitRunner" | tee "$log_file"

# am instrument can return shell success even when tests fail or none were found.
python3 - "$log_file" <<'PY'
from pathlib import Path
import re
import sys

log = Path(sys.argv[1]).read_text()
if "INSTRUMENTATION_CODE: -1" not in log or not re.search(r"\bOK \(8 tests\)", log):
    raise SystemExit("All eight selected API 32 compatibility journeys must pass before exporting coverage.")
if re.search(r"INSTRUMENTATION_STATUS_CODE: -\d+|FAILURES!!!|Failed to generate .*coverage", log):
    raise SystemExit("API 32 instrumentation reported a failure or skipped test.")
PY

"$adb_command" -s "$serial" exec-out run-as "$app_package" \
  cat files/api32-coverage.ec > "$output_dir/coverage.ec"
test -s "$output_dir/coverage.ec"
echo "Collected API 32 coverage from the existing APKs: $output_dir/coverage.ec"
