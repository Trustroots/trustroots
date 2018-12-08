#!/bin/sh

# Restart background worker with correct user (PM2 running worker.js)
export NODE_ENV=production
set -e

# Restart the worker running with `pm2` under user `pm2`
sudo su -c "cd /srv && ./_ci-restart-worker.sh" pm2

