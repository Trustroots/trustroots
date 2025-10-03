#!/bin/bash

cd $(dirname $0)

echo "Quick restart script for Trustroots development..."

# Get the current running container
CONTAINER_NAME=$(docker ps --format "table {{.Names}}" | grep trustroots-dev | head -1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ No running Trustroots container found!"
    echo "Please run dockerLocalDev.sh first to start the development environment."
    exit 1
fi

echo "📦 Found container: $CONTAINER_NAME"

# Rebuild webpack assets first
echo "🔨 Rebuilding webpack assets..."
docker exec $CONTAINER_NAME bash -c "cd /home/app/trustroots && rm -rf public/assets/* && npm run webpack"

# Restart webpack dev server
echo "🔄 Restarting webpack dev server..."
docker exec $CONTAINER_NAME bash -c "pkill -f webpack || true"
sleep 2
docker exec -d $CONTAINER_NAME bash -c "cd /home/app/trustroots && npx webpack serve --hot --config config/webpack/webpack.config.dev.js"

# Wait for webpack to start
echo "⏳ Waiting for webpack dev server to start..."
sleep 10

# Method 1: Try Passenger restart (cleanest)
echo "🔄 Attempting Passenger restart..."
if docker exec $CONTAINER_NAME bash -c "passenger-config restart-app /home/app/trustroots" 2>/dev/null; then
    echo "✅ Passenger restart successful!"
else
    echo "⚠️  Passenger restart failed, trying alternative method..."
    
    # Method 2: Touch restart file
    echo "🔄 Creating restart trigger file..."
    docker exec $CONTAINER_NAME bash -c "mkdir -p /home/app/trustroots/tmp && touch /home/app/trustroots/tmp/restart.txt"
    
    # Method 3: Kill and restart Node process
    echo "🔄 Restarting Node.js process..."
    docker exec $CONTAINER_NAME bash -c "pkill -f 'node.*server.js' || true"
    
    # Wait a moment for Passenger to restart the process
    echo "⏳ Waiting for application to restart..."
    sleep 5
fi

# Check if application is responding
echo "🔍 Checking application status..."
for i in {1..10}; do
    if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Application is responding!"
        break
    else
        echo "⏳ Waiting for application to start... (attempt $i/10)"
        sleep 2
    fi
done

# Test the specific page
echo "🧪 Testing /circles/hitchhikers page..."
if curl -s http://localhost:3000/circles/hitchhikers | grep -q "Debug"; then
    echo "✅ Page is loading and debug info is visible!"
else
    echo "⚠️  Page might not be fully loaded yet. Try accessing http://localhost:3000/circles/hitchhikers in your browser."
fi

echo ""
echo "🎉 Quick restart complete!"
echo "📱 Application should be available at: http://localhost:3000"
echo "🔧 Container: $CONTAINER_NAME"
echo ""
echo "To view logs: docker logs -f $CONTAINER_NAME"
echo "To stop: docker stop $CONTAINER_NAME"
