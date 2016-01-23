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
sudo npm i -g bower fontello-cli gulp
NODE_ENV=production gulp build:prod

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
