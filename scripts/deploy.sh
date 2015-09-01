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
grunt fontello
NODE_ENV=production grunt build

echo ""
echo "Migrating the database..."
export NODE_ENV=production
migrate up

echo "Redeploying the application... (requires sudo password)"
# https://www.phusionpassenger.com/library/admin/nginx/restart_app.html#passenger-config-restart-app
sudo passenger-config restart-app /

# Deployment notifications to New Relic
# http://newrelic.com/
echo ""
NEW_RELIC_CONF="./config/secret/newrelic.conf"
if [ ! -f "$NEW_RELIC_CONF" ]; then
  echo "Add New Relic API key to $NEW_RELIC_CONF and this script will notify New Relic each time you deploy."
else
  echo "Send deployment notification to New Relic"
  NEW_RELIC_API_KEY=$(cat $NEW_RELIC_CONF)
  curl -H "x-api-key:$NEW_RELIC_API_KEY" -d "deployment[app_name]=Trustroots" -d "deployment[description]=Deployed via deploy.sh" https://api.newrelic.com/deployments.xml > /dev/null 2>&1
fi

echo ""
echo "Passenger status (requires sudo password)"
sudo passenger-status
