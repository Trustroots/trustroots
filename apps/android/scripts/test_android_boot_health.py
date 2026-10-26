"""Offline tests for the bounded Android boot-ANR recovery gate."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("run-with-android-boot-health.sh")


class AndroidBootHealthTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.diagnostics = self.root / "diagnostics"
        self.calls = self.root / "adb-calls"
        self.command_marker = self.root / "command-ran"
        self.adb = self.root / "adb"
        self.adb.write_text(
            """#!/usr/bin/env python3
import os
from pathlib import Path
import sys

args = sys.argv[1:]
with Path(os.environ['ADB_CALLS']).open('a') as calls:
    calls.write(' '.join(args) + '\\n')
rebooted = Path(os.environ['ADB_CALLS'] + '.rebooted').exists()
if os.environ.get('FAKE_FAIL_STATE') == '1' and args[:3] in (['shell', 'dumpsys', 'activity'], ['shell', 'dumpsys', 'window']):
    sys.exit(9)
if args == ['reboot']:
    Path(os.environ['ADB_CALLS'] + '.rebooted').touch()
elif args == ['wait-for-device']:
    pass
elif args[:2] == ['shell', 'getprop']:
    print('1')
elif args[:3] == ['shell', 'dumpsys', 'activity']:
    print('ACTIVITY MANAGER LAST ANR (dumpsys activity lastanr)')
    if os.environ.get('FAKE_ANR') == 'systemui' and not rebooted:
        print('ANR in com.android.systemui')
    elif os.environ.get('FAKE_ANR') == 'delayed' and not rebooted and len(Path(os.environ['ADB_CALLS']).read_text().splitlines()) >= 2:
        print('ANR in com.android.systemui')
    elif os.environ.get('FAKE_ANR') == 'app':
        print('ANR in org.trustroots.android')
    elif os.environ.get('FAKE_ANR') == 'mixed':
        print('ANR in com.android.systemui')
        print('ANR in org.trustroots.android')
    elif os.environ.get('FAKE_ANR') == 'systemui-child':
        print('ANR in com.android.systemui.other')
    else:
        print('No ANR has occurred since boot')
elif args[:3] == ['shell', 'dumpsys', 'window']:
    print('WINDOW MANAGER WINDOWS (dumpsys window windows)')
    if os.environ.get('FAKE_ANR') == 'systemui' and not rebooted:
        print('Window{1 Application Not Responding: com.android.systemui}')
    elif os.environ.get('FAKE_ANR') == 'delayed' and not rebooted and len(Path(os.environ['ADB_CALLS']).read_text().splitlines()) >= 2:
        print('Window{1 Application Not Responding: com.android.systemui}')
    elif os.environ.get('FAKE_ANR') == 'app':
        print('Window{2 Application Not Responding: org.trustroots.android}')
    elif os.environ.get('FAKE_ANR') == 'mixed':
        print('Window{1 Application Not Responding: com.android.systemui}')
        print('Window{2 Application Not Responding: org.trustroots.android}')
    if os.environ.get('FAKE_ANR') == 'systemui-child':
        print('Window{1 Application Not Responding: com.android.systemui.other}')
    print('mCurrentFocus=Window{normal app window}')
"""
        )
        self.adb.chmod(0o755)
        sleep = self.root / "sleep"
        sleep.write_text("#!/bin/sh\nexit 0\n")
        sleep.chmod(0o755)
        timeout = self.root / "timeout"
        timeout.write_text("#!/bin/sh\nshift\nexec \"$@\"\n")
        timeout.chmod(0o755)
        self.environment = dict(
            os.environ,
            PATH=f"{self.root}:{os.environ['PATH']}",
            ADB_CALLS=str(self.calls),
        )

    def run_gate(self, anr=None):
        if anr:
            self.environment["FAKE_ANR"] = anr
        else:
            self.environment.pop("FAKE_ANR", None)
        return subprocess.run(
            ["bash", str(SCRIPT), str(self.diagnostics), "sh", "-c", f"touch '{self.command_marker}'"],
            env=self.environment,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_clean_boot_runs_command_without_reboot(self):
        result = self.run_gate()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(self.command_marker.exists())
        self.assertNotIn("reboot\n", self.calls.read_text())

    def test_boot_ui_anr_reboots_once_then_runs_command(self):
        result = self.run_gate("systemui")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(self.command_marker.exists())
        self.assertEqual(1, self.calls.read_text().splitlines().count("reboot"))

    def test_boot_ui_anr_that_appears_during_health_window_is_recovered(self):
        result = self.run_gate("delayed")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(self.command_marker.exists())
        self.assertEqual(1, self.calls.read_text().splitlines().count("reboot"))

    def test_unexpected_app_anr_fails_without_reboot_or_running_command(self):
        result = self.run_gate("app")
        self.assertEqual(1, result.returncode)
        self.assertFalse(self.command_marker.exists())
        self.assertNotIn("reboot\n", self.calls.read_text())
        self.assertTrue((self.diagnostics / "window.txt").exists())

    def test_unknown_anr_takes_precedence_over_system_ui_anr(self):
        result = self.run_gate("mixed")
        self.assertEqual(1, result.returncode)
        self.assertFalse(self.command_marker.exists())
        self.assertNotIn("reboot\n", self.calls.read_text())

    def test_system_ui_child_package_is_not_treated_as_the_system_ui_process(self):
        result = self.run_gate("systemui-child")
        self.assertEqual(1, result.returncode)
        self.assertFalse(self.command_marker.exists())
        self.assertNotIn("reboot\n", self.calls.read_text())

    def test_unreadable_device_state_fails_instead_of_assuming_healthy(self):
        self.environment["FAKE_FAIL_STATE"] = "1"
        result = self.run_gate()
        self.assertEqual(1, result.returncode)
        self.assertFalse(self.command_marker.exists())
        self.assertNotIn("reboot\n", self.calls.read_text())

    def test_persistent_boot_ui_anr_fails_after_only_one_reboot(self):
        self.environment["FAKE_ANR"] = "systemui"
        # Force the test device to keep reporting the boot dialog after reboot.
        self.adb.write_text(self.adb.read_text().replace(" and not rebooted", ""))
        self.adb.chmod(0o755)
        result = self.run_gate("systemui")
        self.assertEqual(1, result.returncode)
        self.assertFalse(self.command_marker.exists())
        self.assertEqual(1, self.calls.read_text().splitlines().count("reboot"))


if __name__ == "__main__":
    unittest.main()
