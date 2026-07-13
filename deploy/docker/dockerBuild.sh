#!/bin/bash

STATUS=$(git status --porcelain | grep -c '^')

if [[ "$STATUS" != "0" ]]
then
  echo "Cowardly refusing to build with a dirty git"
fi

cd $(dirname $0)

# Stop executing if metadata collection or the image build fails.
set -e

# Get metadata for the code baked into the image. The production Docker context
# excludes .git, so the running app cannot discover these values itself.
COMMIT=$(git rev-parse --short HEAD)
BUILD_COMMIT=$(git rev-parse HEAD)
BUILD_COMMITTED_AT=$(git log -1 --format=%cI)
BUILD_BRANCH=$(git rev-parse --abbrev-ref HEAD)

OS=$(uname -s)

# Switch to the repository root directory
cd ../..

# Production runs on linux/amd64. Without --platform, builds on Apple Silicon
# produce arm64-only images that production cannot pull.
DOCKER=(docker)
if [ "$OS" != "Darwin" ]; then
  DOCKER=(sudo docker)
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
echo "Please push these images now like so:"
echo
echo "docker push ghcr.io/trustrootsops/trustroots:git-${COMMIT} && docker push ghcr.io/trustrootsops/trustroots:latest"
