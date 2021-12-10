#!/bin/sh

# Trustroots CI script
#
# 1. Create this structure:
# - /srv/ci-deploy.sh (this file)
# - /srv/ci-versions (folder)
# - /srv/configs/ci-deploy.conf (file with these contents:
# DEFAULT_DEPLOYMENT_BRANCH=master
# DEPLOYMENT_URL=http://dev.trustroots.org
# GITHUB_REPOSITORY=https://github.com/Trustroots/trustroots
#
# 2. Optionally enable Slack integration by getting a WebHook URL
# and then creating a wfile `/srv/configs/slack.conf` ...with this content:
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
#
# 2. Run the script:
# $ cd /srv && sudo sh ci-deploy.sh
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

export NODE_ENV=production

# Server specific config
. /srv/configs/ci-deploy.conf

echo DEFAULT_DEPLOYMENT_BRANCH:

SLACK_CONFIG="/srv/configs/slack.conf"
DEPLOYMENT_BASE="/srv/ci-versions"
DEPLOYMENT_NAME_SYMLINK="current"
DEPLOYMENT_NAME_PREV_SYMLINK="previous"
DEPLOYMENT_NAME_NEXT=$(date +%Y%m%d_%H%M%S)
SYMLINK_NAME=$(readlink -f "$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_SYMLINK")
DEPLOYMENT_NAME_PREV="$(basename $SYMLINK_NAME)"
DEPLOYMENT_FOLDER="$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_NEXT"
DEPLOYMENT_FOLDER_PREV="$DEPLOYMENT_BASE/$DEPLOYMENT_NAME_PREV"

if [ -z ${1+x} ]; then
  DEPLOYMENT_BRANCH=$DEFAULT_DEPLOYMENT_BRANCH;
else
  DEPLOYMENT_BRANCH="$1";
fi

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
#echo "Clone the repository..."
echo "Clone the repository branch $DEPLOYMENT_BRANCH"
git clone $GITHUB_REPOSITORY.git --branch "$DEPLOYMENT_BRANCH" --single-branch "$DEPLOYMENT_FOLDER"

# Create latest symlink
cd "$DEPLOYMENT_BASE"
sudo rm -f latest
sudo ln -s "$DEPLOYMENT_FOLDER" latest

cd "$DEPLOYMENT_FOLDER"
#echo "Deploying branch $DEPLOYMENT_BRANCH"
#git checkout $DEPLOYMENT_BRANCH

echo ""
echo "Symlink profile uploads directory..."
cd "$DEPLOYMENT_FOLDER/public"
sudo ln -s /srv/uploads-profile uploads-profile

echo ""
echo "Building..."
sudo npm install --cache /tmp/empty-cache

# TODO: for some reason bower stuff didn't get installed with `npm install`, so running this manually:
# 2018-08-20
#npm run postinstall

npm run build

# Symlink config file
echo ""
echo "Setting up configs..."
cd "$DEPLOYMENT_FOLDER/config/env"
sudo rm -f local.js
sudo ln -s /srv/configs/local.js local.js

#echo ""
#echo "Migrating the database..."
#cd "$DEPLOYMENT_FOLDER"
#migrate up

# Make sure user rights are set correctly
cd "$DEPLOYMENT_FOLDER"
sudo chown -R www-data:www-data .

# Stop background job worker
# ...because we're going to mess with
# its symlinked working directory
sudo su -c "pm2 stop worker" pm2

# Point current-symlink to newly build version
cd "$DEPLOYMENT_BASE"
sudo rm -f current
sudo ln -s "$DEPLOYMENT_FOLDER" current

# Point previous-symlink to previous version
sudo rm -f previous
sudo ln -s "$DEPLOYMENT_FOLDER_PREV" previous

# Restart the app (Passenger + pm2 worker)
. /srv/ci-restart.sh

echo ""
echo "Clean out old versions"
cd "$DEPLOYMENT_BASE"
find . -maxdepth 1 -type d -not \( -name '.'  \
                               -or -name "$DEPLOYMENT_NAME_NEXT"  \
                               -or -name "$DEPLOYMENT_NAME_SYMLINK"  \
                               -or -name "$DEPLOYMENT_NAME_PREV"  \
                               -or -name "$DEPLOYMENT_NAME_PREV_SYMLINK" \) -exec rm -fr {} +
ls -l "$DEPLOYMENT_BASE"

if [ -f "$SLACK_CONFIG" ]
  then
    echo ""
    echo "Notifying Slack"
    . "$SLACK_CONFIG"
    # This will test if the variable is not set OR if it is set but is empty
    if [ -z "$SLACK_WEBHOOK_URL" ];
      then
        echo "Variable SLACK_WEBHOOK_URL is not set."
        echo "Get a webhook URL from \"Incoming WebHooks\" on Slack settings"
        echo "Add this to file $SLACK_CONFIG:";
        echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...etc"
    else
      PAYLOAD="payload={\"text\": \"*$(logname)* deployed branch *<$GITHUB_REPOSITORY/tree/$DEPLOYMENT_BRANCH|$DEPLOYMENT_BRANCH>* to *$DEPLOYMENT_URL* :tada:\", \"mrkdwn\": true}"
      CURL_RESULT=$(curl -s -S -X POST --data-urlencode "$PAYLOAD" $SLACK_WEBHOOK_URL);
    fi

    if [ -z "$CURL_RESULT" ]; then
      echo "Something went wrong with Slack integartion. Check your WebHook URL."
    fi
else
  echo "Skipping Slack notification"
fi

echo ""
echo "Done!"


# System status
. /srv/ci-status.sh
