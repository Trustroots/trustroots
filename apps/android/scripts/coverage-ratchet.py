"""Check the Android line/branch coverage floor using exact JaCoCo counters."""

import argparse
from fractions import Fraction
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


METRICS = {"lines": "LINE", "branches": "BRANCH"}


def ratio(counter):
    covered, total = counter["covered"], counter["total"]
    if type(covered) is not int or type(total) is not int or not 0 <= covered <= total or total == 0:
        raise ValueError("Coverage counters must be integers with 0 <= covered <= total and total > 0")
    return Fraction(covered, total)


def read_report(path):
    root = ET.parse(path).getroot()
    result = {"schemaVersion": 1}
    for metric, kind in METRICS.items():
        counter = root.find(f"counter[@type='{kind}']")
        if counter is None:
            raise ValueError(f"Missing aggregate {kind} coverage counter")
        covered = int(counter.attrib["covered"])
        result[metric] = {"covered": covered, "total": covered + int(counter.attrib["missed"])}
        ratio(result[metric])
    return result


def read_baseline(path):
    baseline = json.loads(path.read_text())
    if baseline.get("schemaVersion") != 1:
        raise ValueError("Unsupported Android coverage baseline schema")
    for metric in METRICS:
        ratio(baseline[metric])
    return baseline


def regressions(current, baseline):
    failures = []
    for metric in METRICS:
        actual, minimum = ratio(current[metric]), ratio(baseline[metric])
        if actual < minimum:
            failures.append(f"{metric}: {float(actual):.4%} is below baseline {float(minimum):.4%}")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("--reference", type=Path, help="Baseline from the PR base commit; prevents lowering the floor")
    parser.add_argument("--update", action="store_true", help="Raise the baseline; regressions are refused")
    args = parser.parse_args()
    current = read_report(args.report)
    baseline = read_baseline(args.baseline) if args.baseline.exists() else None
    if baseline is None and not args.update:
        raise ValueError("Android baseline is missing; initialise it with --update after a full test run")
    failures = regressions(current, baseline) if baseline else []
    if args.reference:
        failures += ["Baseline lowered: " + failure for failure in regressions(baseline or current, read_baseline(args.reference))]
    if failures:
        raise ValueError("Android coverage ratchet failed:\n" + "\n".join(failures))
    if args.update:
        args.baseline.write_text(json.dumps(current, indent=2) + "\n")
        print(f"Updated {args.baseline}; commit this file when coverage improves.")
    else:
        print("Android coverage ratchet passed (lines and branches).")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, ET.ParseError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
