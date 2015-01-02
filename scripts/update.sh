#!/bin/sh

echo "Trustroots updater"
echo ""
echo "If NPM gives EACCESS errors, you probably have an issue with directory permissions."
echo "Read http://stackoverflow.com/a/16151707 for how to fix it."

# Go to project top
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR=$SCRIPT_DIR/..
cd "$APP_DIR"

echo ""
echo "Updating NPM packages..."
npm update

echo ""
echo "Updating Bower modules..."
bower update

echo ""
echo "That's all!"
