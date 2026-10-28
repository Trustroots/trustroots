"""Render JaCoCo's merged unit/device report without adding or averaging percentages."""

import argparse
from pathlib import Path
import xml.etree.ElementTree as ET


def metric(element, kind):
    counter = element.find(f"counter[@type='{kind}']")
    if counter is None:
        return "—"
    covered = int(counter.attrib["covered"])
    total = covered + int(counter.attrib["missed"])
    return f"{covered}/{total} ({covered / total:.1%})" if total else "—"


def coverage_table(root):
    rows = [
        "# Android code coverage",
        "",
        "Measured from combined debug unit tests and device journeys. Only generated",
        "R and BuildConfig classes are excluded; untested production files remain in the totals.",
        "Proven generated instructions are corrected before line aggregation; raw XML and an audit are retained.",
        "Branch counters are checked against the raw report and remain unchanged.",
        "A dash means there are no executable lines or branches for that counter.",
        "",
        "| Package | Lines covered / total | Branches covered / total |",
        "| --- | ---: | ---: |",
    ]
    for package in sorted(root.findall("package"), key=lambda item: item.attrib["name"]):
        name = package.attrib["name"].replace("org/trustroots/android", "android").replace("/", ".")
        rows.append(f"| {name} | {metric(package, 'LINE')} | {metric(package, 'BRANCH')} |")
    rows.append(f"| **Total** | **{metric(root, 'LINE')}** | **{metric(root, 'BRANCH')}** |")
    rows += [
        "",
        "| Source file | Lines covered / total | Branches covered / total |",
        "| --- | ---: | ---: |",
    ]
    for package in sorted(root.findall("package"), key=lambda item: item.attrib["name"]):
        prefix = package.attrib["name"].removeprefix("org/trustroots/android").lstrip("/")
        for source in sorted(package.findall("sourcefile"), key=lambda item: item.attrib["name"]):
            counter = source.find("counter[@type='LINE']")
            # Kotlin SMAP may name inlined library files with no executable lines.
            if counter is None or int(counter.attrib["covered"]) + int(counter.attrib["missed"]) == 0:
                continue
            name = "/".join(filter(None, [prefix, source.attrib["name"]]))
            rows.append(f"| {name} | {metric(source, 'LINE')} | {metric(source, 'BRANCH')} |")
    return "\n".join(rows) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    table = coverage_table(ET.parse(args.report).getroot())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(table)
    print(table, end="")
