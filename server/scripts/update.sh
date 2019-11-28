#!/bin/sh

echo "Trustroots Updater"

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo ""
echo "Updating..."
git pull            # Get the latest code for the current branch
npm run update      # Update NPM
npm run migrate     # Migrate database up

echo ""
echo "That's all! You can run the app by typing `npm start`"
echo ""
exit 0
