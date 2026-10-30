#!/bin/sh
# Usage: tests/visual/ui/run.sh OUTPUT_DIR
# Builds the fixture page with the checkout's app CSS and screenshots it.
set -eu
root=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$root"
pnpm exec vite build --config tests/visual/ui/vite.config.mts
SHOTS_DIR="$1" pnpm exec playwright test -c tests/visual/ui/playwright.config.cts shoot styles
