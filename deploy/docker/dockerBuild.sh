#!/bin/bash

# Stop executing if metadata collection or the image build fails.
set -e

# Switch to the repository root directory.
cd "$(dirname "$0")/../.."

BUILD_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BUILD_BRANCH" != "main" ]; then
  echo "Docker builds may only be made from the main branch (currently: ${BUILD_BRANCH})." >&2
  exit 1
fi

STATUS=$(git status --short)
if [ -n "$STATUS" ]; then
  echo "Warning: building with uncommitted changes:"
  echo
  echo "$STATUS"
  echo
  echo "Continuing the Docker build in 10 seconds. Press Ctrl-C to cancel."
  sleep 10
fi

# Get metadata for the code baked into the image. The production Docker context
# excludes .git, so the running app cannot discover these values itself.
COMMIT=$(git rev-parse --short HEAD)
BUILD_COMMIT=$(git rev-parse HEAD)
BUILD_COMMITTED_AT=$(git log -1 --format=%cI)

OS=$(uname -s)

# Production runs on linux/amd64. Without --platform, builds on Apple Silicon
# produce arm64-only images that production cannot pull.
DOCKER=(docker)
if [ "$OS" != "Darwin" ]; then
  DOCKER=(sudo docker)
fi

if ! "${DOCKER[@]}" info >/dev/null 2>&1; then
  echo "Docker is not available. Start the Docker daemon and try again." >&2
  exit 1
fi

"${DOCKER[@]}" build --platform linux/amd64 \
  --build-arg "TRUSTROOTS_BUILD_COMMIT=${BUILD_COMMIT}" \
  --build-arg "TRUSTROOTS_BUILD_COMMITTED_AT=${BUILD_COMMITTED_AT}" \
  --build-arg "TRUSTROOTS_BUILD_BRANCH=${BUILD_BRANCH}" \
  -f ./production.Dockerfile . \
  -t ghcr.io/trustrootsops/trustroots:latest \
  -t "ghcr.io/trustrootsops/trustroots:git-${COMMIT}"

echo
echo "Docker images built."
echo
echo "The following images will be pushed automatically:"
echo
echo "docker push ghcr.io/trustrootsops/trustroots:git-${COMMIT} && docker push ghcr.io/trustrootsops/trustroots:latest"
echo
echo "Pushing images in 10 seconds. Press Ctrl-C to cancel."
sleep 10

"${DOCKER[@]}" push "ghcr.io/trustrootsops/trustroots:git-${COMMIT}"
"${DOCKER[@]}" push ghcr.io/trustrootsops/trustroots:latest
