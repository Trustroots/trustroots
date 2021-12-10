#!/bin/sh

# Restart Passenger and background worker (PM2 running worker.js)

# Restart Passenger
cd /srv
sudo ./_ci-restart-passenger.sh

# Restart the worker running with `pm2` under user `pm2`
sudo su -c "cd /srv && ./_ci-restart-worker.sh" pm2
