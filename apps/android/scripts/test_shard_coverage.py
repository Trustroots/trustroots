"""Exercise shard selection and failure handling without an Android emulator."""

import importlib.util
from pathlib import Path
import unittest
import subprocess

import test_legacy_coverage as legacy


class ShardCoverageCollectorTest(unittest.TestCase):
    setUp = legacy.LegacyCoverageCollectorTest.setUp
    adb_calls = legacy.LegacyCoverageCollectorTest.adb_calls
    assert_no_coverage_export = legacy.LegacyCoverageCollectorTest.assert_no_coverage_export

    @property
    def output_directory(self):
        return self.android_root / "app/build/outputs/code_coverage/debugAndroidTest/connected/api36-1"

    def run_collector(self, **configuration):
        source = Path(__file__).with_name("collect-shard-coverage.sh").read_text()
        # Supply the shard argument via a wrapper, retaining the existing fake-adb harness.
        self.script.write_text('set -- 1\n' + source)
        return legacy.LegacyCoverageCollectorTest.run_collector(
            self, FAKE_SDK="36", **configuration
        )

    def test_invalid_shard_arguments_fail_before_adb(self):
        script = Path(__file__).with_name("collect-shard-coverage.sh")
        for arguments in ([], ["2"], ["-1"], ["0", "1"]):
            with self.subTest(arguments=arguments):
                result = subprocess.run(["bash", str(script), *arguments], capture_output=True, text=True)
                self.assertEqual(2, result.returncode)
                self.assertIn("Usage:", result.stderr)

    def test_shard_uses_shared_apks_and_exports_coverage(self):
        result = self.run_collector()
        self.assertEqual(0, result.returncode, result.stderr)
        calls = [call.split("\t") for call in self.adb_calls()]
        instrument = next(call for call in calls if "instrument" in call)
        self.assertEqual("2", instrument[instrument.index("numShards") + 1])
        self.assertEqual("1", instrument[instrument.index("shardIndex") + 1])
        self.assertNotIn("class", instrument)
        self.assertEqual(self.fake_coverage_source.read_bytes(), (self.output_directory / "coverage.ec").read_bytes())

    def test_failed_or_empty_shards_cannot_export_coverage(self):
        for output in (
            "INSTRUMENTATION_CODE: -1\nOK (0 tests)\n",
            "INSTRUMENTATION_STATUS_CODE: -2\nINSTRUMENTATION_CODE: -1\nOK (7 tests)\n",
            "INSTRUMENTATION_CODE: -1\nOK (7 tests)\nFailed to generate coverage\n",
            "Process crashed.\n",
        ):
            with self.subTest(output=output):
                self.fake_adb_log.unlink(missing_ok=True)
                result = self.run_collector(INSTRUMENTATION_OUTPUT=output)
                self.assertNotEqual(0, result.returncode)
                self.assert_no_coverage_export()

    def test_sdk_gated_skips_are_allowed(self):
        result = self.run_collector(INSTRUMENTATION_OUTPUT="INSTRUMENTATION_STATUS_CODE: -3\nINSTRUMENTATION_CODE: -1\nOK (6 tests)\n")
        self.assertEqual(0, result.returncode, result.stderr)


spec = importlib.util.spec_from_file_location("coverage_inputs", Path(__file__).with_name("check-coverage-inputs.py"))
coverage_inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage_inputs)


class CoverageInputsTest(unittest.TestCase):
    def test_all_shards_unit_data_and_original_classes_are_required(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory)
            paths = [
                *(f"outputs/code_coverage/debugAndroidTest/connected/{target}/coverage.ec" for target in ("api36-0", "api36-1", "api32")),
                "outputs/unit_test_code_coverage/debugUnitTest/test.exec",
                "intermediates/built_in_kotlinc/debug/compileDebugKotlin/classes/Example.class",
                "intermediates/javac/debug/compileDebugJavaWithJavac/classes/BuildConfig.class",
            ]
            for relative in paths:
                path = build / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"fixture")
            coverage_inputs.check_inputs(build)
            for relative in paths:
                with self.subTest(missing=relative):
                    path = build / relative
                    path.unlink()
                    with self.assertRaises(ValueError):
                        coverage_inputs.check_inputs(build)
                    path.write_bytes(b"fixture")
            for relative in paths[:4]:
                with self.subTest(empty=relative):
                    path = build / relative
                    path.write_bytes(b"")
                    with self.assertRaises(ValueError):
                        coverage_inputs.check_inputs(build)
                    path.write_bytes(b"fixture")


if __name__ == "__main__":
    unittest.main()
