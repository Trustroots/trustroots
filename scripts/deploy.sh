#!/bin/bash

# Trustroots CI script
#
# 1. Create this structure:
# $ /srv/ci-deploy.sh (this file)
# $ /srv/ci-versions (folder)
#
# 2. Run the script:
# $ cd srv && sudo sh ci-deploy.sh
#
# 3. You'll end up with this structure:
# $ ls -1 /srv/ci-versions
#
# $ 20160812_171255
# $ 20160812_171625
# $ current
# $ previous
#


set -e

echo ""
echo "Deploying Trustroots (requires sudo)"

if [ -z ${1+x} ]; then
  DEPLOYMENT_BRANCH="production";
else
  DEPLOYMENT_BRANCH="$1";
fi

export NODE_ENV=production

DEPLOYMENT_BASE="/srv/ci-versions"
DEPLOYMENT_NAME_SYMLINK="current"
DEPLOYMENT_NAME_PREV_SYMLINK="previous"
DEPLOYMENT_NAME_NEXT=$(date +%Y%m%d_%H%M%S)
SYMLINK_NAME=$(readlink -f "$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_SYMLINK")
DEPLOYMENT_NAME_PREV="$(basename $SYMLINK_NAME)"
DEPLOYMENT_FOLDER="$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_NEXT"
DEPLOYMENT_FOLDER_PREV="$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_PREV"

echo ""
echo "Deployment branch:         $DEPLOYMENT_BRANCH"
echo "Deployment base folder:    $DEPLOYMENT_BASE"
echo "Deploying to folder:       $DEPLOYMENT_NAME_NEXT"
echo "Previous deployment:       $DEPLOYMENT_NAME_PREV"
echo "Symlinks to access these:  $DEPLOYMENT_NAME_SYMLINK, $DEPLOYMENT_NAME_PREV_SYMLINK"

# Ensure this folder exists and operate from it
echo ""
echo "Create new deployment directory ($DEPLOYMENT_FOLDER)..."
sudo mkdir -p "$DEPLOYMENT_FOLDER"
sudo chown $(whoami) "$DEPLOYMENT_FOLDER"

# Clone the repo
echo ""
echo "Clone the repository..."
git clone https://github.com/Trustroots/trustroots.git "$DEPLOYMENT_FOLDER"
cd "$DEPLOYMENT_FOLDER"
echo "Deploying branch $DEPLOYMENT_BRANCH"
git checkout $DEPLOYMENT_BRANCH

echo ""
echo "Building..."
npm install --quiet
npm run build:prod

echo ""
echo "Ensure profile avatar uploads directory exists and point it to images..."
mkdir -p "$DEPLOYMENT_FOLDER/modules/users/client/img/profile"
cd "$DEPLOYMENT_FOLDER/modules/users/client/img/profile"
ln -s /srv/uploads uploads

cd "$DEPLOYMENT_FOLDER/config/env"
rm -f local.js
ln -s /srv/configs/local.js local.js

#echo ""
#echo "Migrating the database..."
#cd "$DEPLOYMENT_FOLDER"
#migrate up

# Make sure user rights are set correctly
cd "$DEPLOYMENT_FOLDER"
sudo chown -R www-data:www-data .

# Point current-symlink to newly build version
cd "$DEPLOYMENT_BASE"
sudo rm -f current
sudo ln -s "$DEPLOYMENT_FOLDER" current

# Point previous-symlink to previous version
sudo rm -f previous
sudo ln -s "$DEPLOYMENT_FOLDER_PREV" previous

echo ""
echo "Restarting the application..."
# https://www.phusionpassenger.com/library/admin/nginx/restart_app.html#passenger-config-restart-app
cd /srv/trustroots
sudo passenger-config restart-app /

echo ""
echo "Passenger status"
sudo passenger-status

echo ""
echo "Clean out old versions"
cd "$DEPLOYMENT_BASE"
find . -maxdepth 1 -type d -not \( -name '.' -or -name "$DEPLOYMENT_NAME_NEXT" -or -name "$DEPLOYMENT_NAME_SYMLINK" -or -name "$DEPLOYMENT_NAME_PREV" -or -name "$DEPLOYMENT_NAME$
ls -l "$DEPLOYMENT_BASE"

echo ""
echo "Done!"
