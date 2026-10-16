"""Exercise concurrent container preparation without a Docker daemon."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class ContainerPreparationTests(unittest.TestCase):
    def run_preparation(self, image="example.invalid/dev:commit", fail="", fallback=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / "docker"
            docker.write_text('''#!/usr/bin/env bash
set -eu
echo "$*" >> "$STATE/commands"
if [ "$*" = "$FAIL" ]; then exit 17; fi
if [ "$1 $2" = "pull example.invalid/dev:commit" ]; then
  touch "$STATE/dev-started"
  while [ ! -f "$STATE/mongo-started" ]; do sleep 0.01; done
elif [ "$1" = compose ] && [ "$6" = pull ]; then
  touch "$STATE/mongo-started"
  if [ -n "$EXPECT_DEV" ] && [ "$FAIL" != "pull example.invalid/dev:commit" ]; then
    while [ ! -f "$STATE/dev-started" ]; do sleep 0.01; done
  fi
  if [ "$FALLBACK" = true ]; then exit 1; fi
elif [ "$1" = compose ] && [ "$6" = up ]; then
  touch "$STATE/mongo-finished"
fi
''')
            docker.chmod(0o755)
            result = subprocess.run(
                ["bash", str(Path(__file__).with_name("prepare-e2e-containers.sh"))],
                env={**os.environ, "PATH": f"{root}:{os.environ['PATH']}",
                     "STATE": directory, "TRUSTROOTS_CI_DEV_IMAGE": image,
                     "EXPECT_DEV": image, "FAIL": fail,
                     "FALLBACK": str(fallback).lower()},
                capture_output=True, text=True, timeout=10,
            )
            commands = (root / "commands").read_text()
            return result.returncode, commands, (root / "mongo-finished").exists()

    def test_both_preparations_overlap_and_complete(self):
        code, commands, finished = self.run_preparation()
        self.assertEqual(code, 0)
        self.assertTrue(finished)
        self.assertIn("tag example.invalid/dev:commit trustroots-dev:ci", commands)

    def test_failed_dev_pull_is_propagated_after_waiting_for_mongo(self):
        code, commands, finished = self.run_preparation(fail="pull example.invalid/dev:commit")
        self.assertEqual(code, 17)
        self.assertTrue(finished)
        self.assertNotIn("tag example.invalid/dev:commit", commands)

    def test_failed_tag_and_failed_mongo_start_are_propagated(self):
        for command in ["tag example.invalid/dev:commit trustroots-dev:ci",
                        "compose -f docker-compose.yml -f docker-compose.ci.yml up -d --pull never mongodb"]:
            with self.subTest(command=command):
                self.assertEqual(self.run_preparation(fail=command)[0], 17)

    def test_registry_fallback_is_preserved(self):
        code, commands, finished = self.run_preparation(fallback=True)
        self.assertEqual(code, 0)
        self.assertTrue(finished)
        self.assertIn("pull mongo:4.4", commands)
        self.assertIn("tag mongo:4.4 public.ecr.aws/docker/library/mongo:4.4", commands)

    def test_failed_registry_fallback_does_not_start_mongo(self):
        code, commands, finished = self.run_preparation(fail="pull mongo:4.4", fallback=True)
        self.assertEqual(code, 17)
        self.assertFalse(finished)
        self.assertNotIn("up -d", commands)

    def test_forks_reuse_the_preceding_build_without_pulling_dev(self):
        code, commands, finished = self.run_preparation(image="")
        self.assertEqual(code, 0)
        self.assertTrue(finished)
        self.assertNotIn("trustroots-dev:ci", commands)


if __name__ == "__main__":
    unittest.main()
