#!/bin/sh

set -e

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo "Fetch latest master..."
git pull origin master

echo "Updating packages & assets..."
npm update
bower update
NODE_ENV=production grunt build

echo "Restarting the server..."
sudo service nginx restart
sudo passenger-status

# Deployment notifications
NEW_RELIC_CONF="./config/secret/newrelic.conf"
if [ ! -f "$NEW_RELIC_CONF" ]; then
  echo "Add New Relic API key to $NEW_RELIC_CONF and this script will notify New Relic each time you deploy."
else
  echo "Send deployment notification to New Relic"
  NEW_RELIC_API_KEY=$(cat $NEW_RELIC_CONF)
  curl -H "x-api-key:$NEW_RELIC_API_KEY" -d "deployment[app_name]=Trustroots" -d "deployment[description]=Deployed via update.sh" https://api.newrelic.com/deployments.xml > /dev/null 2>&1
fi
