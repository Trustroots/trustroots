#!/bin/sh

echo "Pointing deploy to current"

cd /srv

# re-create symlink
sudo rm -f trustroots
sudo ln -s /srv/ci-versions/current trustroots

# Restart Passenger
sudo ./_ci-restart-passenger.sh
