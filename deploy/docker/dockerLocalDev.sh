#!/bin/bash

cd $(dirname $0)

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

cd ../..

set -e

echo "Starting Trustroots in development mode (no build, volume mount)..."

# Stop any existing Trustroots containers
docker stop $(docker ps -q --filter "name=trustroots-") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=trustroots-") 2>/dev/null || true

# Create Docker network if it doesn't exist
docker network create trustroots-network 2>/dev/null || true

# Check if MongoDB is already running, if not start it
if ! docker ps | grep -q mongodb-trustroots; then
  docker run -d \
    --name mongodb-trustroots-$TIMESTAMP \
    --network trustroots-network \
    -p 27017:27017 \
    mongo:4.4
  sleep 10

  if ! docker ps | grep -q mongodb-trustroots-$TIMESTAMP; then
    exit 1
  fi
fi

# Get the MongoDB container name
MONGODB_CONTAINER=$(docker ps --format "table {{.Names}}" | grep mongodb-trustroots | head -1)

echo "Starting Trustroots server with volume mount..."

# Start the server container in background
docker run -d \
  --name trustroots-dev-$TIMESTAMP \
  --network trustroots-network \
  -p 3000:80 \
  -v $(pwd):/home/app/trustroots \
  -w /home/app/trustroots \
  -e NODE_ENV=development \
  -e DB_1_PORT_27017_TCP_ADDR=$MONGODB_CONTAINER \
  phusion/passenger-nodejs:2.3.1 \
  /sbin/my_init

echo Wait a moment for container to start
sleep 10

# Copy nginx configuration files
echo "Configuring nginx..."
docker cp deploy/docker/webapp.conf trustroots-dev-$TIMESTAMP:/etc/nginx/sites-enabled/default
docker cp deploy/docker/nginx-confd.conf trustroots-dev-$TIMESTAMP:/etc/nginx/conf.d/nginx.conf


echo   Restart nginx -- here it seems to get stuck, may require Ctrl-C
docker exec trustroots-dev-$TIMESTAMP service nginx restart &

# Install dependencies and build inside the running container
echo "Installing dependencies and building..."
docker exec trustroots-dev-$TIMESTAMP bash -c "cd /home/app/trustroots && ln -sf /usr/bin/python3 /usr/bin/python && apt-get update && apt-get install -y build-essential python3-dev libmagic1 libmagic-dev && npm ci --legacy-peer-deps --ignore-scripts && npm rebuild mmmagic --build-from-source && npm rebuild && npm run build"

echo
echo
echo "Trustroots is available at: http://localhost:3000"
echo "MongoDB container: $MONGODB_CONTAINER"
echo
echo "To stop: docker stop trustroots-dev-$TIMESTAMP"
echo "To view logs: docker logs -f trustroots-dev-$TIMESTAMP"

# Follow the logs
docker logs -f trustroots-dev-$TIMESTAMP
