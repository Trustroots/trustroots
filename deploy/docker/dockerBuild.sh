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

if [ "$OS" = "Darwin" ]; then
  docker build -f ./production.Dockerfile . -t trustrootsops/trustroots:latest -t "trustrootsops/trustroots:git-${COMMIT}"
else
  sudo docker build -f ./production.Dockerfile . -t trustrootsops/trustroots:latest -t "trustrootsops/trustroots:git-${COMMIT}"
fi

echo
echo "Docker images built."
echo
echo "trustrootsops/trustroots:latest"
echo "trustrootsops/trustroots:git-${COMMIT}"
