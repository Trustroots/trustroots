#!/bin/sh

echo "Deploying Trustroots"

echo ""
echo "Pull latest from the currently active branch..."
git pull

echo ""
echo "Updating packages & assets..."
npm update --production
npm prune --production
bower update --allow-root --config.interactive=false
npm i -g fontello-cli
grunt fontello
NODE_ENV=production grunt build

echo ""
echo "Migrating the database..."
export NODE_ENV=production
migrate up

echo "Redeploying the application... (requires sudo password)"
# https://www.phusionpassenger.com/library/admin/nginx/restart_app.html#passenger-config-restart-app
sudo passenger-config restart-app /

echo ""
echo "Passenger status (requires sudo password)"
sudo passenger-status
