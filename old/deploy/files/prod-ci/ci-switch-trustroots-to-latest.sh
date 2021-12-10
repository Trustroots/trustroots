#!/bin/sh

echo "Pointing deploy to latest"

cd /srv

# re-create symlink
sudo rm -f trustroots
sudo ln -s /srv/ci-versions/latest trustroots

# Restart
sudo ./ci-restart.sh
