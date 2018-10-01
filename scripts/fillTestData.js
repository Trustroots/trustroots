'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    cities = JSON.parse(fs.readFileSync(path.resolve('./scripts/fillTestDataCities.json'), 'utf8')),
    savedCounter = 0;

require(path.resolve('./modules/users/server/models/user.server.model'));
require(path.resolve('./modules/offers/server/models/offer.server.model'));

var User = mongoose.model('User');
var Offer = mongoose.model('Offer');


var random = function (max) {
  return Math.floor(Math.random() * max);
};

var randomizeLoaction = function () {
  var random = Math.random();
  if (random > 0.98) {
    random = ((Math.random() - 0.5) * Math.random() * 4) - 1;
  } else {
    random = random / 10000 - 0.00005;
  }
  return parseFloat(random.toFixed(5));
};

var addOffer = function (id, index, max) {
  var offer = new Offer();

  var city = cities[random(cities.length)];
  var lat = city.lat + randomizeLoaction();
  var lon = city.lon + randomizeLoaction();
  var location = [lat, lon];

  offer.type = 'host';
  offer.status = _.sample(['yes', 'maybe']);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = id;
  offer.location = location;
  offer.locationFuzzy = location;

  offer.save(function(err) {
    if (err != null) console.log(err);
    else {
      savedCounter++;
      if (savedCounter >= max) {
        console.log(chalk.green('Done with ' + max + ' test users!'));
        console.log(chalk.white('')); // Reset to white
        process.exit(0);
      }
    }
  });
};

var addUsers = function (index, max) {
  var user = new User();

  user.firstName = faker.name.firstName();
  user.lastName = faker.name.lastName();
  user.displayName = user.firstName + ' ' + user.lastName;
  user.provider = 'local';
  user.public = true;
  user.avatarUploaded = false;
  user.avatarSource = 'none';
  user.email = index + faker.internet.email();
  user.password = faker.internet.password();
  user.username = index + user.displayName.toLowerCase().replace('\'', '').replace(' ', '');

  user.save(function(err) {
    if (err) {
      console.log(err);
    }
  });
  index++;
  addOffer(user._id, index, max);

  if (index <= max) {
    addUsers(index, max);
  }

};

// Create optional admin user
var adminUsername = (process.argv[3] == null) ? false : process.argv[3];

// Number of users is required
if (process.argv[2] == null) {
  console.log(chalk.red('Please give a number of users to add.'));
} else {

  // Bootstrap db connection
  mongooseService.connect(function() {
    mongooseService.loadModels(function() {

      var numberOfUsers = process.argv[2];

      // Create admin user + regular users
      if (adminUsername !== false) {
        var adminUser = new User();

        adminUser.firstName = faker.name.firstName();
        adminUser.lastName = faker.name.lastName();
        adminUser.displayName = adminUser.firstName + ' ' + adminUser.lastName;
        adminUser.provider = 'local';
        adminUser.email = 'admin+' + adminUsername + '@example.com';
        adminUser.password = 'password123';
        adminUser.username = adminUsername;
        adminUser.avatarSource = 'none';
        adminUser.public = true;
        adminUser.avatarUploaded = false;

        adminUser.save(function(err) {
          if (!err) {
            console.log('Created admin user. Login with: ' + adminUsername + ' / password');
          } else {
            console.log(chalk.red('Could not add admin user ' + adminUsername));
            console.log(err);
          }

          // Add regular users
          console.log('Generating ' + numberOfUsers + ' users...');
          if (numberOfUsers > 2000) {
            console.log('...this might really take a while... go grab some coffee!');
          }
          addUsers(1, numberOfUsers);
        });
      } else {
        // Add regular users
        console.log('Generating ' + numberOfUsers + ' users...');
        if (numberOfUsers > 2000) {
          console.log('...this might really take a while... go grab some coffee!');
        }
        addUsers(0, numberOfUsers);
      }

    });
  });
}
