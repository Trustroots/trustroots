#!/bin/sh

echo "Pointing deploy to previous"

cd /srv

# re-create symlink
sudo rm -f trustroots
sudo ln -s /srv/ci-versions/previous trustroots

# Restart
sudo ./ci-restart.sh
