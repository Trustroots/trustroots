"""Skip application CI only when every changed path is known documentation."""

import json
import os
from pathlib import PurePosixPath
import re
import subprocess


def is_documentation(filename):
    path = PurePosixPath(filename)
    if path.suffix != ".md":
        return False
    return (
        len(path.parts) == 1
        or path.parts[0] in {"docs", "openspec"}
        or (path.parts[0] in {"apps", "deploy"} and path.name == "README.md")
    )


def comparison(event_name, event):
    if event_name == "pull_request":
        base = event["pull_request"]["base"]["sha"]
        head = event["pull_request"]["head"]["sha"]
        separator = "..."
    elif event_name == "push":
        base, head = event["before"], event["after"]
        separator = ".."
    else:
        return None  # Manual runs always honour the requested test selection.
    if not all(re.fullmatch(r"[0-9a-f]{40}", sha) and int(sha, 16) for sha in (base, head)):
        return None
    return base + separator + head


def docs_only(event_name, event):
    revision_range = comparison(event_name, event)
    if revision_range is None:
        return False
    # Include both paths of a rename, including moves from code to documentation.
    result = subprocess.run(
        ["git", "diff", "--name-only", "--no-renames", "-z", revision_range, "--"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    paths = result.stdout.decode("utf-8", errors="surrogateescape").rstrip("\0").split("\0")
    return bool(paths[0]) and all(is_documentation(path) for path in paths)


def main():
    try:
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
            event = json.load(event_file)
        skip = docs_only(os.environ["GITHUB_EVENT_NAME"], event)
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError):
        print("Unable to classify changes; running application CI.")
        skip = False
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"run-code={'false' if skip else 'true'}\n")
    print("Documentation-only changes: skipping application CI." if skip else "Running application CI.")


if __name__ == "__main__":
    main()
