#!/bin/bash

STATUS=$(git status --porcelain | grep -c '^')

if [[ "$STATUS" != "0" ]]
then
  echo "Cowardly refusing to build with a dirty git"
  exit 1
fi

# Get the current commit hash of the repository
COMMIT=$(git rev-parse --short HEAD)

OS=$(uname -s)

# Switch to the repository root directory
cd ../..

# Stop executing if we hit any errors
set -e

if [ "$OS" = "Darwin" ]; then
  docker build -f ./production.Dockerfile . -t ghcr.io/trustrootsops/trustroots:latest -t "ghcr.io/trustrootsops/trustroots:git-${COMMIT}"
else
  sudo docker build -f ./production.Dockerfile . -t ghcr.io/trustrootsops/trustroots:latest -t "ghcr.io/trustrootsops/trustroots:git-${COMMIT}"
fi

echo
echo "Docker images built."
echo
echo "Please push these images now like so:"
echo
echo "docker push ghcr.io/trustrootsops/trustroots:git-${COMMIT}"
echo "docker push ghcr.io/trustrootsops/trustroots:latest"
