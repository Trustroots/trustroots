"""Reject incomplete distributed Android coverage before generating a report."""

from pathlib import Path
import sys


def check_inputs(build):
    for target in ("api36-0", "api36-1", "api32"):
        path = build / "outputs/code_coverage/debugAndroidTest/connected" / target / "coverage.ec"
        if not path.is_file() or not path.stat().st_size:
            raise ValueError(f"Missing or empty device coverage: {target}")
    unit_files = list((build / "outputs/unit_test_code_coverage/debugUnitTest").glob("*.exec"))
    if not unit_files or any(not path.stat().st_size for path in unit_files):
        raise ValueError("Missing or empty JVM coverage")
    for directory in (
        "intermediates/built_in_kotlinc/debug/compileDebugKotlin/classes",
        "intermediates/javac/debug/compileDebugJavaWithJavac/classes",
    ):
        if not any((build / directory).rglob("*.class")):
            raise ValueError(f"Missing original compiled classes: {directory}")


if __name__ == "__main__":
    try:
        check_inputs(Path(sys.argv[1]))
    except ValueError as error:
        raise SystemExit(str(error)) from error
