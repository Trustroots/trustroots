#!/bin/bash

cd $(dirname $0)

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OS=$(uname -s)

cd ../..

set -e

docker-compose down 2>/dev/null || true

docker stop $(docker ps -q --filter "name=mongodb-trustroots-") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=mongodb-trustroots-") 2>/dev/null || true

# docker build --no-cache -f ./production.Dockerfile . -t trustroots-local:$TIMESTAMP

docker build -f ./production.Dockerfile . -t trustroots-local:$TIMESTAMP --cache-from trustroots-local:latest

docker tag trustroots-local:$TIMESTAMP trustroots-local:latest

docker run -d --name mongodb-trustroots-$TIMESTAMP -p 27017:27017 mongo:4.4

sleep 10

if ! docker ps | grep -q mongodb-trustroots-$TIMESTAMP; then
  exit 1
fi

echo "Trustroots is available at: http://localhost:3000"
echo
echo

docker run --rm -it \
  --name trustroots-$TIMESTAMP \
  --link mongodb-trustroots-$TIMESTAMP:mongodb \
  -p 3000:80 \
  -e NODE_ENV=development \
  -e DB_1_PORT_27017_TCP_ADDR=mongodb \
  trustroots-local:$TIMESTAMP