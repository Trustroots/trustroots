#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../deploy/docker"

prepare_dev() {
  # Fork runs already built their image using Buildx in the preceding step.
  if [ -n "${TRUSTROOTS_CI_DEV_IMAGE:-}" ]; then
    docker pull "$TRUSTROOTS_CI_DEV_IMAGE"
    docker tag "$TRUSTROOTS_CI_DEV_IMAGE" trustroots-dev:ci
  fi
}

prepare_mongodb() {
  local version="${TRUSTROOTS_CI_MONGO_VERSION:-4.4}"
  # Either public registry can rate-limit shared CI runner addresses.
  if ! docker compose -f docker-compose.yml -f docker-compose.ci.yml pull mongodb; then
    docker pull "mongo:$version"
    docker tag "mongo:$version" "public.ecr.aws/docker/library/mongo:$version"
  fi
  docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --pull never mongodb
}

# Keep errexit enabled inside each child and await both even if one fails.
prepare_dev &
dev_pid=$!
prepare_mongodb &
mongodb_pid=$!
status=0
wait "$dev_pid" || status=$?
wait "$mongodb_pid" || status=$?
exit "$status"
