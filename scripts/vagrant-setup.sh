#!/bin/bash

# Sets up Vagrant development box
# https://www.vagrantup.com/

cd "$(dirname $0)/.."

echo ""
echo "-------------------------------------------------------------------------"
echo ""
echo "      o-O-o o--o  o   o  o-o  o-O-o o--o   o-o   o-o  o-O-o  o-o  "
echo "        |   |   | |   | |       |   |   | o   o o   o   |   |     "
echo "        |   O-Oo  |   |  o-o    |   O-Oo  |   | |   |   |    o-o  "
echo "        |   |  \  |   |     |   |   |  \  o   o o   o   |       | "
echo "        o   o   o  o-o  o--o    o   o   o  o-o   o-o    o   o--o  "
echo ""
echo "-------------------------------------------------------------------------"
echo ""

if [ -d "node_modules" ]; then
    echo 'You probably want to rm -rf node_modules'
    exit
fi

# Let's roll...
vagrant plugin install vagrant-hostmanager

# This will go trough vagrantup/vagrantup.sh on first run
vagrant up
