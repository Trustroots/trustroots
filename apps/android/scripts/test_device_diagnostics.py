"""Offline checks for preserving command failures while collecting device diagnostics."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("run-with-device-diagnostics.sh")


class DeviceDiagnosticsTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.diagnostics = self.root / "device diagnostics"
        self.adb = self.root / "adb"
        self.adb.write_text("#!/bin/sh\nprintf '%s\\n' \"$*\"\nexit \"${FAKE_ADB_EXIT:-0}\"\n")
        self.adb.chmod(0o755)
        self.environment = dict(os.environ, PATH=f"{self.root}:{os.environ['PATH']}")

    def run_command(self, code):
        return subprocess.run(
            ["bash", str(SCRIPT), str(self.diagnostics), sys.executable, "-c", code],
            env=self.environment, capture_output=True, text=True, check=False,
        )

    def test_success_keeps_command_arguments_and_does_not_collect_diagnostics(self):
        result = self.run_command("print('a successful command with spaces')")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("a successful command with spaces", result.stdout)
        self.assertFalse(self.diagnostics.exists())

    def test_failure_collects_device_state_and_preserves_the_original_exit_status(self):
        result = self.run_command("raise SystemExit(17)")
        self.assertEqual(17, result.returncode)
        self.assertEqual("logcat -d -v threadtime\n", (self.diagnostics / "logcat.txt").read_text())
        self.assertEqual("shell dumpsys window windows\n", (self.diagnostics / "window.txt").read_text())
        self.assertEqual("shell dumpsys activity activities\n", (self.diagnostics / "activities.txt").read_text())
        self.assertEqual("shell dumpsys activity lastanr\n", (self.diagnostics / "last-anr.txt").read_text())

    def test_unavailable_device_does_not_hide_the_command_failure(self):
        self.environment["FAKE_ADB_EXIT"] = "1"
        result = self.run_command("raise SystemExit(23)")
        self.assertEqual(23, result.returncode)
        self.assertEqual(4, len(list(self.diagnostics.iterdir())))

    def test_unwritable_diagnostics_path_keeps_the_original_failure(self):
        self.diagnostics.write_text("An existing regular file blocks the directory")
        result = self.run_command("raise SystemExit(19)")
        self.assertEqual(19, result.returncode)

    def test_emulator_runner_commands_are_individually_valid_shell_commands(self):
        workflow = SCRIPT.resolve().parents[3] / ".github/workflows/android-debug-apk.yml"
        lines = workflow.read_text().splitlines()
        commands = []
        emulator_step = False
        for index, line in enumerate(lines):
            if line.startswith("      - "):
                emulator_step = False
            if "uses: reactivecircus/android-emulator-runner@" in line:
                emulator_step = True
            if not emulator_step or line.strip() != "script: |":
                continue
            for command in lines[index + 1:]:
                if not command.startswith("            "):
                    break
                if command.strip():
                    commands.append(command.strip())
        self.assertTrue(commands)
        for command in commands:
            with self.subTest(command=command):
                result = subprocess.run(["sh", "-n", "-c", command], capture_output=True, text=True, check=False)
                self.assertEqual(0, result.returncode, result.stderr)

    def test_missing_arguments_fail_before_running_a_command(self):
        result = subprocess.run(["bash", str(SCRIPT)], capture_output=True, text=True, check=False)
        self.assertEqual(2, result.returncode)
        self.assertIn("Usage:", result.stderr)


if __name__ == "__main__":
    unittest.main()
