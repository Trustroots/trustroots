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

# These files could be compiled for wrong OS
if [ -d "node_modules" ]; then
    echo "Error: You probably want to 'rm -rf node_modules' first"
    exit
fi

# Let's roll...
vagrant plugin install vagrant-hostmanager

# This will go trough vagrantup/vagrantup.sh on first run
vagrant up

# Livereload
vagrant ssh -c "cd /srv/trustroots && grunt watch"
