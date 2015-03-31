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

# Let's roll...
vagrant plugin install vagrant-hostmanager

# This will go trough vagrantup/vagrantup.sh on first run
vagrant up
