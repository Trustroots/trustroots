import runpy
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


coverage = runpy.run_path(Path(__file__).with_name("coverage-table.py"))


class CoverageTableTest(unittest.TestCase):
    def test_uses_merged_counters_rather_than_averaging_file_percentages(self):
        report = ET.fromstring('''<report>
            <package name="org/trustroots/android/ui">
                <counter type="LINE" covered="3" missed="1"/>
                <counter type="BRANCH" covered="1" missed="1"/>
            </package>
            <counter type="LINE" covered="3" missed="1"/>
            <counter type="BRANCH" covered="1" missed="1"/>
        </report>''')
        table = coverage["coverage_table"](report)
        self.assertIn("| android.ui | 3/4 (75.0%) | 1/2 (50.0%) |", table)
        self.assertIn("| **Total** | **3/4 (75.0%)** | **1/2 (50.0%)** |", table)

    def test_keeps_untested_files_visible(self):
        report = ET.fromstring('''<report>
            <package name="org/trustroots/android/ui">
                <sourcefile name="Example.kt">
                    <counter type="LINE" covered="0" missed="5"/>
                </sourcefile>
            </package>
        </report>''')
        self.assertIn("| ui/Example.kt | 0/5 (0.0%) | — |", coverage["coverage_table"](report))

    def test_missing_or_empty_counters_do_not_divide_by_zero(self):
        self.assertEqual("—", coverage["metric"](ET.fromstring("<report/>"), "LINE"))
        report = ET.fromstring('<report><counter type="BRANCH" covered="0" missed="0"/></report>')
        self.assertEqual("—", coverage["metric"](report, "BRANCH"))


if __name__ == "__main__":
    unittest.main()
