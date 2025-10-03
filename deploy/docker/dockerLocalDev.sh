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

echo "MongoDB container: $MONGODB_CONTAINER"
echo "MongoDB connection string: mongodb://$MONGODB_CONTAINER:27017/trustroots"
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
  -e DB_1_PORT_27017_TCP_PORT=27017 \
  -e MONGODB_URI=mongodb://$MONGODB_CONTAINER:27017/trustroots \
  -e MONGODB_URL=mongodb://$MONGODB_CONTAINER:27017/trustroots \
  phusion/passenger-nodejs:2.3.1 \
  /sbin/my_init

echo Wait a moment for container to start
sleep 10

# Copy nginx configuration files
echo "Configuring nginx..."
docker cp deploy/docker/webappLocalDev.conf trustroots-dev-$TIMESTAMP:/etc/nginx/sites-enabled/default
docker cp deploy/docker/nginx-confd.conf trustroots-dev-$TIMESTAMP:/etc/nginx/conf.d/nginx.conf


echo   Restart nginx -- here it seems to get stuck, may require Ctrl-C
docker exec trustroots-dev-$TIMESTAMP service nginx restart &

# Create a local.js config file to override database connection
echo "Creating local.js configuration..."
docker exec trustroots-dev-$TIMESTAMP bash -c "cat > /home/app/trustroots/config/env/local.js << 'EOF'
module.exports = {
  host: '0.0.0.0',
  db: {
    uri: 'mongodb://$MONGODB_CONTAINER:27017/trustroots',
    checkCompatibility: false,
  },
};
EOF"

# Create a custom webpack dev config with correct proxy target
echo "Creating webpack dev configuration..."
docker exec trustroots-dev-$TIMESTAMP bash -c "cd /home/app/trustroots && cp config/webpack/webpack.config.js config/webpack/webpack.config.dev.js && sed -i 's/target: .*localhost:3001.*/target: \"http:\/\/localhost:80\",/' config/webpack/webpack.config.dev.js"

# Install dependencies and build inside the running container
echo "Installing dependencies and building..."
docker exec trustroots-dev-$TIMESTAMP bash -c "cd /home/app/trustroots && ln -sf /usr/bin/python3 /usr/bin/python && apt-get update && apt-get install -y build-essential python3-dev libmagic1 libmagic-dev && mkdir -p /root/.npm && chmod 777 /root/.npm && npm ci --legacy-peer-deps --ignore-scripts --unsafe-perm && npm rebuild mmmagic --build-from-source --unsafe-perm && npm rebuild --unsafe-perm"

# Build webpack assets for development
echo "Building webpack assets..."
docker exec trustroots-dev-$TIMESTAMP bash -c "cd /home/app/trustroots && npm run webpack"

# Start the webpack dev server in the background
echo "Starting webpack dev server..."
docker exec -d trustroots-dev-$TIMESTAMP bash -c "cd /home/app/trustroots && npx webpack serve --hot --config config/webpack/webpack.config.dev.js"

echo "Waiting for webpack dev server to start..."
sleep 15

echo
echo
echo "Trustroots is available at: http://localhost:3000"
echo "MongoDB container: $MONGODB_CONTAINER"
echo "Webpack dev server: http://localhost:3000 (serves assets with hot reloading)"
echo
echo "To stop: docker stop trustroots-dev-$TIMESTAMP"
echo "To view logs: docker logs -f trustroots-dev-$TIMESTAMP"
echo "To restart webpack: docker exec trustroots-dev-$TIMESTAMP bash -c 'cd /home/app/trustroots && npm run webpack:server'"

# Follow the logs
docker logs -f trustroots-dev-$TIMESTAMP
