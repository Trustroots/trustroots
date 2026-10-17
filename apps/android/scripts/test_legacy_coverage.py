"""Offline tests for the API 32 coverage collector shell script."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("collect-legacy-coverage.sh")
SUCCESSFUL_INSTRUMENTATION = "INSTRUMENTATION_CODE: -1\nOK (8 tests)\n"


FAKE_ADB = r'''#!{python}
import os
from pathlib import Path
import sys

args = sys.argv[1:]
with Path(os.environ["FAKE_ADB_LOG"]).open("a") as log:
    log.write("\t".join(args) + "\n")

if args == ["get-serialno"]:
    print(os.environ.get("FAKE_SERIAL", "emulator-5554"))
elif len(args) >= 4 and args[0] == "-s" and args[2:4] == ["shell", "getprop"]:
    print(os.environ.get("FAKE_SDK", "32"))
elif len(args) >= 9 and args[0] == "-s" and args[2:8] == ["shell", "pm", "list", "packages", "--user", "0"]:
    print(os.environ.get("FAKE_PM_PACKAGES", "package:org.trustroots.android.debug"))
    sys.exit(int(os.environ.get("FAKE_PM_PACKAGES_EXIT", "0")))
elif len(args) >= 3 and args[0] == "-s" and args[2] == "uninstall":
    sys.exit(int(os.environ.get("FAKE_UNINSTALL_EXIT", "0")))
elif len(args) >= 4 and args[0] == "-s" and args[2:4] == ["install", "-r"]:
    sys.exit(int(os.environ.get("FAKE_INSTALL_EXIT", "0")))
elif len(args) >= 4 and args[0] == "-s" and args[2:4] == ["shell", "am"] and args[4:5] == ["instrument"]:
    print(os.environ.get("INSTRUMENTATION_OUTPUT", ""), end="")
    sys.exit(int(os.environ.get("INSTRUMENTATION_EXIT", "0")))
elif len(args) >= 2 and args[0] == "-s" and "exec-out" in args:
    sys.stdout.buffer.write(Path(os.environ["FAKE_COVERAGE_SOURCE"]).read_bytes())
'''


class LegacyCoverageCollectorTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.android_root = self.root / "apps" / "android"
        self.script = self.android_root / "scripts" / SCRIPT.name
        self.script.parent.mkdir(parents=True)
        shutil.copyfile(SCRIPT, self.script)
        self.app_apk = self.android_root / "app/build/outputs/apk/debug/app-debug.apk"
        self.test_apk = self.android_root / "app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"
        self.app_apk.parent.mkdir(parents=True)
        self.test_apk.parent.mkdir(parents=True)
        self.app_apk.write_bytes(b"fictional app APK fixture")
        self.test_apk.write_bytes(b"fictional instrumented APK fixture")

        self.fake_adb_log = self.root / "fake-adb.log"
        self.fake_coverage_source = self.root / "fake-coverage.ec"
        self.fake_coverage_source.write_bytes(b"fake-jacoco-probe-bytes\x00\x01")
        self.fake_adb = self.root / "fake-adb"
        self.fake_adb.write_text(FAKE_ADB.format(python=sys.executable))
        self.fake_adb.chmod(0o755)

    @property
    def output_directory(self):
        return self.android_root / "app/build/outputs/code_coverage/debugAndroidTest/connected/api32"

    def run_collector(self, **configuration):
        environment = os.environ.copy()
        environment.pop("ANDROID_SERIAL", None)
        environment.update(
            {
                "ADB": str(self.fake_adb),
                "FAKE_ADB_LOG": str(self.fake_adb_log),
                "FAKE_COVERAGE_SOURCE": str(self.fake_coverage_source),
                "INSTRUMENTATION_OUTPUT": SUCCESSFUL_INSTRUMENTATION,
                "INSTRUMENTATION_EXIT": "0",
            }
        )
        environment.update(configuration)
        return subprocess.run(
            ["bash", str(self.script)],
            check=False,
            capture_output=True,
            text=True,
            env=environment,
            timeout=30,
        )

    def adb_calls(self):
        if not self.fake_adb_log.exists():
            return []
        return self.fake_adb_log.read_text().splitlines()

    def assert_no_coverage_export(self):
        self.assertFalse(
            any("exec-out" in call for call in self.adb_calls()),
            "The collector must not fetch JaCoCo probes for an invalid instrumentation run",
        )
        self.assertFalse((self.output_directory / "coverage.ec").exists())

    def test_successful_api32_run_exports_the_fixture_probe_file(self):
        result = self.run_collector()

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("OK (8 tests)", result.stdout)
        self.assertIn("Collected API 32 coverage", result.stdout)
        self.assertEqual(self.fake_coverage_source.read_bytes(), (self.output_directory / "coverage.ec").read_bytes())
        calls = [call.split("\t") for call in self.adb_calls()]
        installs = [call for call in calls if call[2:4] == ["install", "-r"]]
        self.assertEqual(2, len(installs))
        uninstall = next(call for call in calls if len(call) >= 3 and call[2] == "uninstall")
        self.assertEqual(["uninstall", "org.trustroots.android.debug"], uninstall[2:4])
        self.assertLess(calls.index(uninstall), calls.index(installs[0]))
        self.assertFalse(any(call[2:4] == ["uninstall", "org.trustroots.android.debug.test"] for call in calls))
        self.assertIn(
            ["-s", "emulator-5554", "shell", "pm", "list", "packages", "--user", "0", "org.trustroots.android.debug"],
            calls,
        )
        instrument_calls = [call.split("\t") for call in self.adb_calls() if "\tshell\tam\tinstrument\t" in call]
        self.assertEqual(1, len(instrument_calls))
        class_filter = instrument_calls[0][instrument_calls[0].index("class") + 1]
        self.assertEqual(
            "org.trustroots.android.notifications.SdkNotificationCompatibilityJourneyTest,org.trustroots.android.browser.EmbeddedBrowserStyleTest#legacyStylingOnlyRunsForTrustrootsPagesWithoutDocumentStartSupport,org.trustroots.android.browser.BrowserNavigationJourneyTest#externalNavigationRequiresConfirmationAndCanBeCancelled,org.trustroots.android.ui.AccountPreviewUpdateAlertsJourneyTest#memberCanEnableCheckRetryOpenAndDisablePreviewUpdatesOffline,org.trustroots.android.api.SecureMobileSessionStoreTest#savesAndLoadsTheCurrentMemberSessionWithoutPlaintextPreferences,org.trustroots.android.api.OfflineCacheJourneyTest#cacheEvictsOnlyTheRequestedCategoriesAndRejectsOversizedSnapshots,org.trustroots.android.ui.AccountMessagePermissionGrantedJourneyTest#grantedMessagePermissionStartsEnableWithTheCurrentActivityAndSession",
            class_filter,
        )
        self.assertEqual(1, sum("exec-out" in call for call in self.adb_calls()))

    def test_rejects_a_non_emulator_before_touching_the_apks_or_exporting(self):
        result = self.run_collector(FAKE_SERIAL="fixture-device-01")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("requires a dedicated Android emulator", result.stderr)
        self.assertFalse(any("install" in call for call in self.adb_calls()))
        self.assertFalse(any("pm" in call or "uninstall" in call for call in self.adb_calls()))
        self.assert_no_coverage_export()

    def test_rejects_a_sdk_other_than_32_before_installing_or_exporting(self):
        result = self.run_collector(FAKE_SDK="33")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("requires API 32; found 33", result.stderr)
        self.assertFalse(any("install" in call for call in self.adb_calls()))
        self.assertFalse(any("pm" in call or "uninstall" in call for call in self.adb_calls()))
        self.assert_no_coverage_export()

    def test_uninstall_waits_for_apk_guards_and_real_uninstall_errors_stop_install(self):
        self.test_apk.unlink()
        result = self.run_collector()

        self.assertNotEqual(0, result.returncode)
        self.assertIn("Missing previously built APK", result.stderr)
        self.assertFalse(any("pm" in call or "uninstall" in call or "install" in call for call in self.adb_calls()))

        self.fake_adb_log.unlink(missing_ok=True)
        self.test_apk.write_bytes(b"fictional instrumented APK fixture")
        result = self.run_collector(FAKE_UNINSTALL_EXIT="1")

        self.assertNotEqual(0, result.returncode)
        calls = [call.split("\t") for call in self.adb_calls()]
        self.assertTrue(any(call[2:4] == ["uninstall", "org.trustroots.android.debug"] for call in calls))
        self.assertFalse(any(call[2:4] == ["install", "-r"] for call in calls))

        self.fake_adb_log.unlink(missing_ok=True)
        result = self.run_collector(FAKE_INSTALL_EXIT="1")

        self.assertNotEqual(0, result.returncode)
        calls = [call.split("\t") for call in self.adb_calls()]
        self.assertEqual(1, sum(call[2:4] == ["install", "-r"] for call in calls))
        self.assertFalse(any(call[2:5] == ["shell", "am", "instrument"] for call in calls))

    def test_empty_package_list_treats_absent_package_as_already_clean(self):
        result = self.run_collector(FAKE_PM_PACKAGES="")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse(any("uninstall" in call for call in self.adb_calls()))
        self.assertEqual(2, sum(call.split("\t")[2:4] == ["install", "-r"] for call in self.adb_calls()))

    def test_test_package_alone_is_not_uninstalled_as_the_debug_app(self):
        result = self.run_collector(FAKE_PM_PACKAGES="package:org.trustroots.android.debug.test")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertFalse(any("uninstall" in call for call in self.adb_calls()))

    def test_both_packages_only_uninstalls_the_exact_debug_app(self):
        result = self.run_collector(
            FAKE_PM_PACKAGES="package:org.trustroots.android.debug.test\npackage:org.trustroots.android.debug"
        )

        self.assertEqual(0, result.returncode, result.stderr)
        calls = [call.split("\t") for call in self.adb_calls()]
        self.assertEqual(
            1,
            sum(call[2:4] == ["uninstall", "org.trustroots.android.debug"] for call in calls),
        )
        self.assertFalse(any(call[2:4] == ["uninstall", "org.trustroots.android.debug.test"] for call in calls))

    def test_package_list_command_failure_stops_before_uninstall_or_install(self):
        result = self.run_collector(FAKE_PM_PACKAGES_EXIT="1")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("Could not check whether org.trustroots.android.debug is installed", result.stderr)
        self.assertFalse(any("uninstall" in call or "install" in call for call in self.adb_calls()))

    def test_unexpected_package_list_output_stops_before_uninstall_or_install(self):
        result = self.run_collector(FAKE_PM_PACKAGES="permission denied")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("Unexpected response while checking", result.stderr)
        self.assertFalse(any("uninstall" in call or "install" in call for call in self.adb_calls()))

    def test_invalid_instrumentation_runs_never_export_probe_files(self):
        invalid_runs = {
            "zero tests": (
                "INSTRUMENTATION_CODE: -1\nOK (0 tests)\n",
                "All eight selected API 32 compatibility journeys must pass",
            ),
            "stale old test count": (
                "INSTRUMENTATION_CODE: -1\nOK (4 tests)\n",
                "All eight selected API 32 compatibility journeys must pass",
            ),
            "failed test": (
                "INSTRUMENTATION_STATUS_CODE: -2\nFAILURES!!!\nINSTRUMENTATION_CODE: -1\nOK (8 tests)\n",
                "API 32 instrumentation reported a failure or skipped test",
            ),
            "skipped test": (
                "INSTRUMENTATION_STATUS_CODE: -3\nINSTRUMENTATION_CODE: -1\nOK (8 tests)\n",
                "API 32 instrumentation reported a failure or skipped test",
            ),
            "coverage error": (
                "INSTRUMENTATION_CODE: -1\nOK (8 tests)\nFailed to generate API 32 coverage file\n",
                "API 32 instrumentation reported a failure or skipped test",
            ),
        }
        for case, (instrumentation_output, expected_error) in invalid_runs.items():
            with self.subTest(case=case):
                self.fake_adb_log.unlink(missing_ok=True)
                result = self.run_collector(INSTRUMENTATION_OUTPUT=instrumentation_output)

                self.assertNotEqual(0, result.returncode)
                self.assert_no_coverage_export()
                self.assertIn(expected_error, result.stderr)

    def test_invalid_instrumentation_removes_an_old_probe_file_without_exporting(self):
        self.output_directory.mkdir(parents=True)
        previous_probe_file = self.output_directory / "coverage.ec"
        previous_probe_file.write_bytes(b"stale-probe-data")

        result = self.run_collector(INSTRUMENTATION_OUTPUT="INSTRUMENTATION_CODE: -1\nOK (0 tests)\n")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("All eight selected API 32 compatibility journeys must pass", result.stderr)
        self.assertFalse(previous_probe_file.exists(), "A failed run must not leave stale probes looking current")
        self.assertFalse(any("exec-out" in call for call in self.adb_calls()))

    def test_instrumentation_process_failure_blocks_export_even_with_success_text(self):
        result = self.run_collector(INSTRUMENTATION_EXIT="1")

        self.assertNotEqual(0, result.returncode)
        self.assertIn("OK (8 tests)", result.stdout)
        self.assert_no_coverage_export()


if __name__ == "__main__":
    unittest.main()
