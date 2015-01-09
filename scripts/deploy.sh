#!/bin/sh

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo "Pull latest from the production branch..."
git pull origin production

echo "Updating packages & assets..."
npm update --production
bower update
NODE_ENV=production grunt build

echo ""
echo "Migrating database..."
migrate

echo "Redeploying the application..."
# https://www.phusionpassenger.com/documentation/Users%20guide%20Nginx.html#_redeploying_restarting_the_rack_application
touch tmp/restart.txt

# Deployment notifications to New Relic
# http://newrelic.com/
NEW_RELIC_CONF="./config/secret/newrelic.conf"
if [ ! -f "$NEW_RELIC_CONF" ]; then
  echo "Add New Relic API key to $NEW_RELIC_CONF and this script will notify New Relic each time you deploy."
else
  echo "Send deployment notification to New Relic"
  NEW_RELIC_API_KEY=$(cat $NEW_RELIC_CONF)
  curl -H "x-api-key:$NEW_RELIC_API_KEY" -d "deployment[app_name]=Trustroots" -d "deployment[description]=Deployed via deploy.sh" https://api.newrelic.com/deployments.xml > /dev/null 2>&1
fi

echo "Show Passenger status (requires sudo)"
sudo passenger-status
