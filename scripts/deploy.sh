#!/bin/bash

# Check that we're at the right folder
if [ ! -f ./server.js ]; then
  >&2 echo "Error: You're probably trying to run the script from a wrong path. Enter the folder where Trustroots is installed and type bash scripts/deploy.sh"
  exit
fi

echo "Deploying Trustroots (requires sudo)"

# Make sure user rights are set correctly
sudo chown -R www-data:www-data .

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

# Make sure user rights are set correctly
sudo chown -R www-data:www-data .

echo ""
echo "Restarting the application..."
# https://www.phusionpassenger.com/library/admin/nginx/restart_app.html#passenger-config-restart-app
sudo passenger-config restart-app /

echo ""
echo "Passenger status"
sudo passenger-status
