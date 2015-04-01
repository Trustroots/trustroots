#!/bin/bash

# Sets up Vagrant development box

# Don't run this script directly; run 'vagrant up' instead



# Install Git
echo ""
echo "---------------------------------------------------------------------"
echo "Setting up prerequisites..."
echo ""
# Somehow LC_ALL is missing from locale...
# http://stackoverflow.com/questions/10134901/why-sudo-cat-gives-a-permission-denied-but-sudo-vim-works-fine#comment12992710_10134932
echo 'echo "LC_ALL=\"en_US.UTF-8\"" >> /etc/default/locale' | sudo -s
LC_ALL="en_US.UTF-8"
sudo mkdir -p /srv/logs/
sudo apt-get update -qq
sudo apt-get install -q -y git build-essential


# Install NodeJS
echo ""
echo "---------------------------------------------------------------------"
echo "Installing NodeJS & NPM..."
echo ""
sudo apt-get install -q -y nodejs npm
sudo ln -fs /usr/bin/nodejs /usr/local/bin/node


# Install Nginx
echo ""
echo "---------------------------------------------------------------------"
echo "Installing Nginx..."
echo ""
sudo apt-get install -q -y nginx
sudo mkdir -p /srv/logs/nginx
sudo rm /etc/nginx/sites-enabled/default
sudo ln -s /srv/trustroots/scripts/vagrantup/nginx_trustroots_dev.conf /etc/nginx/sites-enabled/trustroots_dev.conf


# Install MongoDB
echo ""
echo "---------------------------------------------------------------------"
echo "Installing MongoDB..."
echo ""
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | sudo tee /etc/apt/sources.list.d/mongodb.list
sudo apt-get update -qq
sudo apt-get install -q -y mongodb-org


# Install & configure Phusion Passenger
# https://www.phusionpassenger.com/documentation/Users%20guide%20Nginx.html#install_on_debian_ubuntu
echo ""
echo "---------------------------------------------------------------------"
echo "Installing Phusion Passenger..."
echo ""
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 561F9B9CAC40B2F7
sudo apt-get install apt-transport-https ca-certificates
echo 'echo "deb https://oss-binaries.phusionpassenger.com/apt/passenger/4 trusty main" >> /etc/apt/sources.list.d/passenger.list' | sudo -s
sudo chown root: /etc/apt/sources.list.d/passenger.list
sudo chmod 600 /etc/apt/sources.list.d/passenger.list
sudo apt-get update -qq
sudo apt-get install -q -y --force-yes nginx-extras passenger
sudo service nginx restart
# Uncomment passenger variables from Nginx config:
sudo perl -pi -e 's/# passenger_/passenger_/g' /etc/nginx/nginx.conf
# We don't need passenger-ruby, but node
sudo perl -pi -e 's/passenger_ruby \/usr\/bin\/ruby;/passenger_nodejs \/usr\/local\/bin\/node;/g' /etc/nginx/nginx.conf


# Install NodeJS tools
echo ""
echo "---------------------------------------------------------------------"
echo "Installing NodeJS tools..."
echo ""
sudo npm install -g bower grunt-cli gulp yo generator-meanjs node-gyp bson


# Install packages & build assets
echo ""
echo "---------------------------------------------------------------------"
echo "Installing Node modules & generating assets..."
echo ""
cd /srv/trustroots/
npm install
bower install --config.interactive=false
NODE_ENV=development grunt build


# Add configs
cp /srv/trustroots/config/secret/_template.js /srv/trustroots/config/secret/development.js
cp /srv/trustroots/config/secret/_template.js /srv/trustroots/config/secret/production.js
cp /srv/trustroots/config/secret/_template.js /srv/trustroots/config/secret/test.js

# Generate test content
echo ""
echo "---------------------------------------------------------------------"
echo "Generating test content, this might take a while..."
echo ""
cd /srv/trustroots/
NODE_ENV=development node scripts/fillTestData.js 1000

# Final restart
sudo service nginx restart

# And we're done!
echo ""
echo ""
echo "---------------------------------------------------------------------"
echo ""
echo "Boom! Trustroots Vagrant box is now installed!"
echo ""
echo ""
echo "Vagrant is up. Open http://trustroots.dev/ in your browser."
echo ""
echo "You can login with user 'trout' and password 'password'."
echo ""
echo "Suspend the virtual machine by calling 'vagrant suspend'."
echo "When you're ready to begin working again, just run 'vagrant up'."
echo ""
echo "Read more from http://github.com/trustroots/trustroots"
echo ""
