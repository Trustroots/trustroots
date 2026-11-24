#!/usr/bin/env bash
set -euo pipefail

endpoint="repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/artifacts"
for attempt in {1..12}; do
  count=$(gh api --method GET "$endpoint" -f "name=$ARTIFACT_NAME" \
    --jq '[.artifacts[] | select(.expired == false)] | length') || count=0
  if [ "$count" = 1 ]; then
    exit 0
  fi
  if [ "$attempt" != 12 ]; then
    sleep 5
  fi
done

echo "::error::Pages artifact $ARTIFACT_NAME did not become available."
exit 1
