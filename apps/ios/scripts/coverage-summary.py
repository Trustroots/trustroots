"""Summarise Xcode xccov JSON for Trustroots application targets.

Excludes test bundles from published totals so the headline reflects the
Trustroots app rather than XCTest scaffolding. Writes markdown for GitHub
Actions step summaries and a compact JSON artefact for the iOS coverage check.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def is_application_target(name: str) -> bool:
    return not (name.endswith(".xctest") or name.endswith("Tests"))


def application_targets(report: dict) -> list[dict]:
    targets = report.get("targets") or []
    return [target for target in targets if is_application_target(str(target.get("name", "")))]


def aggregate_lines(targets: list[dict]) -> dict:
    covered = sum(int(target.get("coveredLines") or 0) for target in targets)
    total = sum(int(target.get("executableLines") or 0) for target in targets)
    return {"covered": covered, "total": total}


def format_ratio(covered: int, total: int) -> str:
    if total <= 0:
        return "—"
    return f"{covered}/{total} ({covered / total:.1%})"


def compact_summary(report: dict) -> dict:
    targets = application_targets(report)
    lines = aggregate_lines(targets)
    return {
        "schemaVersion": 1,
        "lines": lines,
        "targets": [
            {
                "name": target.get("name"),
                "coveredLines": int(target.get("coveredLines") or 0),
                "executableLines": int(target.get("executableLines") or 0),
                "lineCoverage": float(target.get("lineCoverage") or 0.0),
            }
            for target in sorted(targets, key=lambda item: str(item.get("name") or ""))
        ],
    }


def coverage_markdown(report: dict) -> str:
    targets = application_targets(report)
    lines = aggregate_lines(targets)
    rows = [
        "# iOS code coverage",
        "",
        "Measured from the simulator test job with Xcode code coverage enabled.",
        "Test bundles (`*.xctest` / `*Tests`) are omitted from the application totals.",
        "A dash means there are no executable lines for that counter.",
        "",
        "| Target | Lines covered / total |",
        "| --- | ---: |",
    ]
    for target in sorted(targets, key=lambda item: str(item.get("name") or "")):
        name = str(target.get("name") or "unknown")
        covered = int(target.get("coveredLines") or 0)
        total = int(target.get("executableLines") or 0)
        rows.append(f"| {name} | {format_ratio(covered, total)} |")
    rows.append(f"| **Total** | **{format_ratio(lines['covered'], lines['total'])}** |")
    rows += [
        "",
        "| Source file | Lines covered / total |",
        "| --- | ---: |",
    ]
    files = []
    for target in targets:
        for source in target.get("files") or []:
            covered = int(source.get("coveredLines") or 0)
            total = int(source.get("executableLines") or 0)
            if total <= 0:
                continue
            files.append((str(source.get("name") or source.get("path") or "unknown"), covered, total))
    for name, covered, total in sorted(files, key=lambda item: item[0]):
        rows.append(f"| {name} | {format_ratio(covered, total)} |")
    if not files:
        rows.append("| — | — |")
    return "\n".join(rows) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path, help="xccov --report --json output")
    parser.add_argument("--markdown", type=Path, help="Write markdown summary here")
    parser.add_argument("--json-out", type=Path, help="Write compact JSON summary here")
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    markdown = coverage_markdown(report)
    summary = compact_summary(report)
    if args.markdown:
        args.markdown.parent.mkdir(parents=True, exist_ok=True)
        args.markdown.write_text(markdown)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(summary, indent=2) + "\n")
    print(markdown, end="")


if __name__ == "__main__":
    main()
