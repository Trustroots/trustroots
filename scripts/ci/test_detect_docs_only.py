import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from detect_docs_only import comparison, docs_only, is_documentation, main


class DocumentationDetectionTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.previous_directory = os.getcwd()
        os.chdir(self.directory.name)
        self.addCleanup(os.chdir, self.previous_directory)
        self.environment = patch.dict(os.environ, {
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.git("init", "-q", "-b", "main")
        Path("README.md").write_text("Example documentation\n")
        Path("app.js").write_text("// Example code\n")
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output([
            "git", "-c", "user.name=Example", "-c", "user.email=example@example.org", *args,
        ], stderr=subprocess.PIPE).decode().strip()

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "Example change")
        return self.git("rev-parse", "HEAD")

    def push_is_docs_only(self):
        return docs_only("push", {"before": self.base, "after": self.commit()})

    def test_documentation_allowlist(self):
        for name in ["README.md", "CONTRIBUTING.md", "docs/guide.md",
                     "openspec/specs/example/spec.md", "apps/android/README.md",
                     "deploy/docker/README.md"]:
            with self.subTest(name=name):
                self.assertTrue(is_documentation(name))
        for name in ["app.js", "package-lock.json", ".github/workflows/test.yml",
                     "docs/script.js", "tests/fixtures/example.md", "modules/example.md"]:
            with self.subTest(name=name):
                self.assertFalse(is_documentation(name))

    def test_readme_only_push_skips_tests(self):
        Path("README.md").write_text("Updated documentation\n")
        self.assertTrue(self.push_is_docs_only())

    def test_mixed_push_runs_tests(self):
        Path("README.md").write_text("Updated documentation\n")
        Path("app.js").write_text("// Changed code\n")
        self.assertFalse(self.push_is_docs_only())

    def test_code_deletion_runs_tests(self):
        Path("app.js").unlink()
        self.assertFalse(self.push_is_docs_only())

    def test_code_renamed_to_documentation_runs_tests(self):
        self.git("mv", "app.js", "example.md")
        self.assertFalse(self.push_is_docs_only())

    def test_documentation_rename_skips_tests(self):
        self.git("mv", "README.md", "GUIDE.md")
        self.assertTrue(self.push_is_docs_only())

    def test_pr_uses_merge_base_when_main_has_advanced(self):
        self.git("checkout", "-qb", "docs-change")
        Path("README.md").write_text("Updated documentation\n")
        head = self.commit()
        self.git("checkout", "-q", "main")
        Path("app.js").write_text("// Main advanced\n")
        base = self.commit()
        self.assertTrue(docs_only("pull_request", {
            "pull_request": {"base": {"sha": base}, "head": {"sha": head}},
        }))

    def test_empty_diff_and_manual_run_do_not_skip(self):
        self.assertFalse(docs_only("push", {"before": self.base, "after": self.base}))
        self.assertFalse(docs_only("workflow_dispatch", {}))

    def test_new_branch_or_invalid_revision_does_not_skip(self):
        for before in ["0" * 40, "invalid"]:
            self.assertIsNone(comparison("push", {"before": before, "after": self.base}))

    def test_missing_history_defaults_to_running_ci(self):
        Path("event.json").write_text(json.dumps({"before": "1" * 40, "after": self.base}))
        with patch.dict(os.environ, {
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_EVENT_PATH": "event.json",
            "GITHUB_OUTPUT": "output.txt",
        }):
            main()
        self.assertEqual(Path("output.txt").read_text(), "run-code=true\n")


if __name__ == "__main__":
    unittest.main()
