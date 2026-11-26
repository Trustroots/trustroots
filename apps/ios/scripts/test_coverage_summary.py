import json
import runpy
import tempfile
import unittest
from pathlib import Path


script = Path(__file__).with_name("coverage-summary.py")
summary = runpy.run_path(str(script))


def sample_report():
    return {
        "coveredLines": 12,
        "executableLines": 20,
        "lineCoverage": 0.6,
        "targets": [
            {
                "name": "Trustroots.app",
                "coveredLines": 8,
                "executableLines": 10,
                "lineCoverage": 0.8,
                "files": [
                    {
                        "name": "SignInView.swift",
                        "coveredLines": 5,
                        "executableLines": 5,
                        "lineCoverage": 1.0,
                    },
                    {
                        "name": "UnusedView.swift",
                        "coveredLines": 0,
                        "executableLines": 0,
                        "lineCoverage": 0.0,
                    },
                    {
                        "name": "OfferMapView.swift",
                        "coveredLines": 3,
                        "executableLines": 5,
                        "lineCoverage": 0.6,
                    },
                ],
            },
            {
                "name": "TrustrootsTests.xctest",
                "coveredLines": 4,
                "executableLines": 10,
                "lineCoverage": 0.4,
                "files": [
                    {
                        "name": "TrustrootsTests.swift",
                        "coveredLines": 4,
                        "executableLines": 10,
                        "lineCoverage": 0.4,
                    }
                ],
            },
            {
                "name": "TrustrootsUITests",
                "coveredLines": 0,
                "executableLines": 5,
                "lineCoverage": 0.0,
                "files": [],
            },
        ],
    }


class CoverageSummaryTest(unittest.TestCase):
    def test_excludes_test_bundles_from_application_totals(self):
        compact = summary["compact_summary"](sample_report())
        self.assertEqual({"covered": 8, "total": 10}, compact["lines"])
        self.assertEqual(["Trustroots.app"], [target["name"] for target in compact["targets"]])

    def test_markdown_lists_application_files_only(self):
        markdown = summary["coverage_markdown"](sample_report())
        self.assertIn("# iOS code coverage", markdown)
        self.assertIn("| Trustroots.app | 8/10 (80.0%) |", markdown)
        self.assertIn("| **Total** | **8/10 (80.0%)** |", markdown)
        self.assertIn("| OfferMapView.swift | 3/5 (60.0%) |", markdown)
        self.assertIn("| SignInView.swift | 5/5 (100.0%) |", markdown)
        self.assertNotIn("TrustrootsTests", markdown)
        self.assertNotIn("UnusedView.swift", markdown)

    def test_cli_writes_markdown_and_json(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report = root / "xccov.json"
            markdown_path = root / "coverage.md"
            json_path = root / "coverage-summary.json"
            report.write_text(json.dumps(sample_report()))
            completed = __import__("subprocess").run(
                [
                    __import__("sys").executable,
                    str(script),
                    str(report),
                    "--markdown",
                    str(markdown_path),
                    "--json-out",
                    str(json_path),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertIn("iOS code coverage", completed.stdout)
            self.assertTrue(markdown_path.read_text().startswith("# iOS code coverage"))
            payload = json.loads(json_path.read_text())
            self.assertEqual(1, payload["schemaVersion"])
            self.assertEqual(8, payload["lines"]["covered"])
            self.assertEqual(10, payload["lines"]["total"])


if __name__ == "__main__":
    unittest.main()
