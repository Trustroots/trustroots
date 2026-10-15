import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "fetch_comparison", Path(__file__).with_name("fetch-comparison.py")
)
fetch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetch)


class FetchComparisonTests(unittest.TestCase):
    def test_deepens_only_comparison_history_and_preserves_three_dot_diff(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            clone = Path(directory) / "clone"
            source.mkdir()

            def git(*args):
                return subprocess.check_output(
                    ["git", "-C", str(source), *args], text=True,
                    stderr=subprocess.DEVNULL,
                ).strip()

            def commit(message):
                git("add", ".")
                git("-c", "user.name=Test", "-c", "user.email=test@example.org",
                    "commit", "--allow-empty", "-m", message)
                return git("rev-parse", "HEAD")

            git("init", "-b", "main")
            git("config", "uploadpack.allowFilter", "true")
            (source / "app.js").write_text("original\n")
            commit("base")
            git("checkout", "-b", "feature")
            git("mv", "app.js", "README.md")
            head = commit("rename")
            git("checkout", "main")
            for index in range(40):
                base = commit(f"advance {index}")
            git("branch", "unrelated")
            expected = git("diff", "--name-only", "--no-renames", f"{base}...{head}")
            expected_numstat = git("diff", "--numstat", f"{base}...{head}")
            git("clone", "--depth=1", source.as_uri(), str(clone))
            previous = os.getcwd()
            try:
                os.chdir(clone)
                fetch.fetch_comparison("pull_request", {
                    "pull_request": {"base": {"sha": base}, "head": {"sha": head}}
                })
                self.assertEqual(fetch.git("diff", "--name-only", "--no-renames",
                                           f"{base}...{head}"), expected)
                self.assertNotIn("unrelated", fetch.git("branch", "-r"))
                self.assertEqual(fetch.git("diff", "--numstat", f"{base}...{head}"),
                                 expected_numstat)
            finally:
                os.chdir(previous)

    def test_push_fetches_endpoints_without_requiring_shared_ancestry(self):
        with patch.object(fetch, "git") as git:
            fetch.fetch_comparison("push", {"before": "a" * 40, "after": "b" * 40})
            self.assertEqual(git.call_count, 3)
            self.assertEqual(git.call_args.args[-3:], ("origin", "a" * 40, "b" * 40))

    def test_manual_and_initial_push_do_not_fetch(self):
        with patch.object(fetch, "git") as git:
            fetch.fetch_comparison("workflow_dispatch", {})
            fetch.fetch_comparison("push", {"before": "0" * 40, "after": "b" * 40})
            git.assert_not_called()

    def test_old_branches_fall_back_to_complete_targeted_ancestry(self):
        with patch.object(fetch, "git") as git, patch.object(
            fetch, "complete_merge_base", side_effect=[False] * 4 + [True]
        ):
            fetch.fetch_comparison("pull_request", {
                "pull_request": {"base": {"sha": "a" * 40}, "head": {"sha": "b" * 40}}
            })
            self.assertIn("--unshallow", git.call_args.args)
            self.assertEqual(git.call_count, 7)


if __name__ == "__main__":
    unittest.main()
