#!/usr/bin/env python3
"""Fetch comparison commits without downloading unrelated branches or tags."""

import json
import os
import subprocess

from detect_docs_only import comparison


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def complete_merge_base(base, head):
    try:
        merge_base = git("merge-base", base, head)
    except subprocess.CalledProcessError:
        return False
    if git("rev-parse", "--is-shallow-repository") == "false":
        return True
    # Finding one common ancestor is insufficient if a shallow boundary could
    # conceal a newer one on another parent of a merge commit.
    shallow_path = git("rev-parse", "--git-path", "shallow")
    with open(shallow_path, encoding="utf-8") as shallow_file:
        boundaries = set(shallow_file.read().splitlines())
    above_base = set(git("rev-list", base, head, "^" + merge_base).splitlines())
    return not boundaries.intersection(above_base)


def fetch_comparison(event_name, event):
    revision_range = comparison(event_name, event)
    if revision_range is None:
        return
    separator = "..." if event_name == "pull_request" else ".."
    base, head = revision_range.split(separator)
    # PR summaries inspect changed blobs. Let Git fetch those on demand while
    # omitting the rest of the historical file contents.
    git("config", "remote.origin.promisor", "true")
    git("config", "remote.origin.partialclonefilter", "blob:none")
    options = ["fetch", "--no-tags", "--no-recurse-submodules", "--filter=blob:none"]
    for depth in (32, 128, 512, 2048):
        git(*options, f"--depth={depth}", "origin", base, head)
        if separator == ".." or complete_merge_base(base, head):
            return
    # Old PRs still work: fetch complete ancestry for these two commits only.
    git(*options, "--unshallow", "origin", base, head)
    if not complete_merge_base(base, head):
        raise RuntimeError("Comparison commits do not share a merge base")


if __name__ == "__main__":
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as event_file:
        fetch_comparison(os.environ["GITHUB_EVENT_NAME"], json.load(event_file))
