#!/bin/sh

echo "Trustroots updater"

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo ""
echo "Updating..."
git pull        # Get the latest code for the current branch
npm run update  # Update NPM and Bower modules
npm run migrate # Migrate database up

echo ""
echo "Building..."
npm run build   # Load icons and generate assets

echo ""
echo "That's all!"
exit 0
