import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from detect_docs_only import (
    comparison,
    docs_only,
    is_documentation,
    is_native_app,
    main,
    skips_web_ci,
    web_ci_skippable,
)


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
        Path("apps/android").mkdir(parents=True)
        Path("apps/android/Main.kt").write_text("fun main() {}\n")
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output([
            "git", "-c", "user.name=Example", "-c", "user.email=example@example.org", *args,
        ], stderr=subprocess.PIPE).decode().strip()

    def commit(self):
        self.git("add", ".")
        self.git("commit", "-qm", "Example change")
        return self.git("rev-parse", "HEAD")

    def push_predicates(self):
        event = {"before": self.base, "after": self.commit()}
        return docs_only("push", event), web_ci_skippable("push", event)

    def test_documentation_allowlist(self):
        for name in ["README.md", "CONTRIBUTING.md", "docs/guide.md",
                     "openspec/specs/example/spec.md", "apps/android/README.md",
                     "deploy/docker/README.md"]:
            with self.subTest(name=name):
                self.assertTrue(is_documentation(name))
                self.assertTrue(skips_web_ci(name))
        for name in ["app.js", "package-lock.json", ".github/workflows/test.yml",
                     "docs/script.js", "tests/fixtures/example.md", "modules/example.md"]:
            with self.subTest(name=name):
                self.assertFalse(is_documentation(name))
                self.assertFalse(skips_web_ci(name))

    def test_native_app_paths_skip_web_ci(self):
        for name in ["apps/android/Main.kt", "apps/ios/App.swift", "apps/README.md"]:
            with self.subTest(name=name):
                self.assertTrue(is_native_app(name))
                self.assertTrue(skips_web_ci(name))
        self.assertFalse(is_native_app("modules/users/client/app.js"))

    def test_readme_only_push_skips_tests(self):
        Path("README.md").write_text("Updated documentation\n")
        docs, skip_web = self.push_predicates()
        self.assertTrue(docs)
        self.assertTrue(skip_web)

    def test_apps_only_push_skips_web_ci_but_is_not_docs_only(self):
        Path("apps/android/Main.kt").write_text("fun main() { /* changed */ }\n")
        docs, skip_web = self.push_predicates()
        self.assertFalse(docs)
        self.assertTrue(skip_web)

    def test_apps_and_docs_push_skips_web_ci(self):
        Path("README.md").write_text("Updated documentation\n")
        Path("apps/android/Main.kt").write_text("fun main() { /* changed */ }\n")
        docs, skip_web = self.push_predicates()
        self.assertFalse(docs)
        self.assertTrue(skip_web)

    def test_mixed_push_runs_tests(self):
        Path("README.md").write_text("Updated documentation\n")
        Path("app.js").write_text("// Changed code\n")
        docs, skip_web = self.push_predicates()
        self.assertFalse(docs)
        self.assertFalse(skip_web)

    def test_apps_and_web_code_runs_tests(self):
        Path("apps/android/Main.kt").write_text("fun main() { /* changed */ }\n")
        Path("app.js").write_text("// Changed code\n")
        self.assertFalse(self.push_predicates()[1])

    def test_code_deletion_runs_tests(self):
        Path("app.js").unlink()
        docs, skip_web = self.push_predicates()
        self.assertFalse(docs)
        self.assertFalse(skip_web)

    def test_code_renamed_to_documentation_runs_tests(self):
        self.git("mv", "app.js", "example.md")
        docs, skip_web = self.push_predicates()
        self.assertFalse(docs)
        self.assertFalse(skip_web)

    def test_documentation_rename_skips_tests(self):
        self.git("mv", "README.md", "GUIDE.md")
        docs, skip_web = self.push_predicates()
        self.assertTrue(docs)
        self.assertTrue(skip_web)

    def test_pr_uses_merge_base_when_main_has_advanced(self):
        self.git("checkout", "-qb", "docs-change")
        Path("README.md").write_text("Updated documentation\n")
        head = self.commit()
        self.git("checkout", "-q", "main")
        Path("app.js").write_text("// Main advanced\n")
        base = self.commit()
        event = {
            "pull_request": {"base": {"sha": base}, "head": {"sha": head}},
        }
        self.assertTrue(docs_only("pull_request", event))
        self.assertTrue(web_ci_skippable("pull_request", event))

    def test_empty_diff_and_manual_run_do_not_skip(self):
        self.assertFalse(docs_only("push", {"before": self.base, "after": self.base}))
        self.assertFalse(web_ci_skippable("push", {"before": self.base, "after": self.base}))
        self.assertFalse(docs_only("workflow_dispatch", {}))
        self.assertFalse(web_ci_skippable("workflow_dispatch", {}))

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

    def test_apps_only_main_writes_run_code_false(self):
        Path("apps/android/Main.kt").write_text("fun main() { /* changed */ }\n")
        head = self.commit()
        Path("event.json").write_text(json.dumps({"before": self.base, "after": head}))
        with patch.dict(os.environ, {
            "GITHUB_EVENT_NAME": "push",
            "GITHUB_EVENT_PATH": "event.json",
            "GITHUB_OUTPUT": "output.txt",
        }):
            main()
        self.assertEqual(Path("output.txt").read_text(), "run-code=false\n")


if __name__ == "__main__":
    unittest.main()
