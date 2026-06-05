#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

cd "$ROOT_DIR"

ensure_test_image
ensure_mongo
trap stop_mongo EXIT

run_test npm run test:coverage:server
run_test npm run coverage:check -- --scope=server
