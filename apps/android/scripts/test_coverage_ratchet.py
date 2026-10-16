import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest


script = Path(__file__).with_name("coverage-ratchet.py")
ratchet = runpy.run_path(script)


def baseline(covered=3, total=4):
    return {"schemaVersion": 1, "lines": {"covered": covered, "total": total},
            "branches": {"covered": covered, "total": total}}


class CoverageRatchetTest(unittest.TestCase):
    def test_equal_ratios_and_improvements_pass(self):
        self.assertEqual([], ratchet["regressions"](baseline(6, 8), baseline()))
        self.assertEqual([], ratchet["regressions"](baseline(4, 4), baseline()))

    def test_regressions_are_not_hidden_by_display_rounding(self):
        self.assertEqual(2, len(ratchet["regressions"](baseline(3333, 10000), baseline(1, 3))))

    def test_denominator_growth_cannot_hide_a_coverage_drop(self):
        current = baseline(3, 5)
        minimum = baseline(3, 4)

        failures = ratchet["regressions"](current, minimum)

        self.assertEqual(2, len(failures))
        self.assertTrue(all("below baseline" in failure for failure in failures))

    def test_checks_branches_independently(self):
        current = baseline()
        current["branches"] = {"covered": 1, "total": 4}
        self.assertTrue(ratchet["regressions"](current, baseline())[0].startswith("branches:"))

    def test_branch_margin_is_explicit_and_does_not_change_the_line_floor(self):
        updated = ratchet["raised_baseline"](baseline(30, 40), baseline(1, 4), 2)
        self.assertEqual({"covered": 30, "total": 40}, updated["lines"])
        self.assertEqual({"covered": 28, "total": 40}, updated["branches"])
        self.assertEqual(2, updated["branchMargin"])

    def test_margin_cannot_lower_an_existing_floor(self):
        updated = ratchet["raised_baseline"](baseline(4, 4), baseline(), 2)
        self.assertEqual(baseline()["branches"], updated["branches"])
        with self.assertRaises(ValueError):
            ratchet["raised_baseline"](baseline(), baseline(), -1)

    def test_invalid_counters_are_rejected(self):
        for counter in ({"covered": 0, "total": 0}, {"covered": -1, "total": 4},
                        {"covered": 5, "total": 4}, {"covered": True, "total": 4}):
            with self.subTest(counter=counter), self.assertRaises(ValueError):
                ratchet["ratio"](counter)

    def test_update_cannot_lower_existing_baseline_or_overwrite_it_on_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "coverage.xml"
            report.write_text('<report><counter type="LINE" covered="1" missed="3"/>'
                              '<counter type="BRANCH" covered="1" missed="3"/></report>')
            saved = root / "baseline.json"
            original = json.dumps(baseline())
            saved.write_text(original)
            result = subprocess.run([sys.executable, str(script), str(report), str(saved), "--update"], capture_output=True)
            self.assertNotEqual(0, result.returncode)
            self.assertEqual(original, saved.read_text())

    def test_reference_prevents_manually_lowering_the_floor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "coverage.xml"
            report.write_text('<report><counter type="LINE" covered="4" missed="0"/>'
                              '<counter type="BRANCH" covered="4" missed="0"/></report>')
            saved, previous = root / "baseline.json", root / "previous.json"
            saved.write_text(json.dumps(baseline(1, 4)))
            previous.write_text(json.dumps(baseline()))
            result = subprocess.run([sys.executable, str(script), str(report), str(saved), "--reference", str(previous)], capture_output=True)
            self.assertNotEqual(0, result.returncode)
            self.assertIn(b"Baseline lowered", result.stderr)

    def test_missing_report_counters_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "coverage.xml"
            report.write_text("<report/>")
            with self.assertRaises(ValueError):
                ratchet["read_report"](report)

    def test_missing_report_fails_closed_without_changing_the_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "missing-coverage.xml"
            saved = root / "baseline.json"
            original = json.dumps(baseline())
            saved.write_text(original)

            result = subprocess.run(
                [sys.executable, str(script), str(report), str(saved)],
                capture_output=True,
                text=True,
            )

            self.assertNotEqual(0, result.returncode)
            self.assertIn("missing-coverage.xml", result.stderr)
            self.assertEqual(original, saved.read_text())


if __name__ == "__main__":
    unittest.main()
