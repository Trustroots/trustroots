#!/bin/sh

set -e

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo "Fetch latest master..."
git pull origin master

echo "Updating assets..."
npm update
bower update
grunt build

echo "Restarting the server..."
sudo service nginx restart
sudo passenger-status
