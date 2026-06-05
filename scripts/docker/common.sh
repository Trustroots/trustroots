#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_DIR="$ROOT_DIR/deploy/docker"

export DOCKER_BUILDKIT=1
export COMPOSE_PROJECT_NAME="${TRUSTROOTS_TEST_COMPOSE_PROJECT:-trustroots-test}"

docker_compose() {
  docker compose \
    -f "$COMPOSE_DIR/docker-compose.yml" \
    -f "$COMPOSE_DIR/docker-compose.test.yml" \
    "$@"
}

ensure_test_image() {
  if [ -n "${TRUSTROOTS_TEST_SKIP_BUILD:-}" ] && [ -n "${TRUSTROOTS_TEST_IMAGE:-}" ]; then
    return 0
  fi

  docker_compose build test-runner
}

ensure_mongo() {
  if docker_compose ps --status running mongo-test 2>/dev/null | grep -q mongo-test; then
    return 0
  fi

  docker_compose up -d mongo-test
}

run_test() {
  docker_compose run --rm --no-deps test-runner "$@"
}

stop_mongo() {
  if [ "${TRUSTROOTS_TEST_KEEP_MONGO:-}" = "1" ]; then
    return 0
  fi

  docker_compose stop mongo-test >/dev/null 2>&1 || true
}
