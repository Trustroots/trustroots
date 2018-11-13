'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    fs = require('fs'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    cities = JSON.parse(fs.readFileSync(path.resolve('./bin/fillTestData/data/Cities.json'), 'utf8')),
    savedCounter = 0;

require(path.resolve('./modules/offers/server/models/offer.server.model'));

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

  offer.save(function (err) {
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

var addUsers = function (max, adminUsers) {
  var index = 0;
  var numAdminUsers;

  if (adminUsers === null || adminUsers === undefined) {
    numAdminUsers = 0;
  } else {
    numAdminUsers = adminUsers.length;
  }

  var printWarning = function printWarning() {
    console.log('Generating ' + max + ' users...');
    if (max > 2000) {
      console.log('...this might really take a while... go grab some coffee!');
    }
  };

  if (numAdminUsers === 0) {
    printWarning();
  }

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Tribe = mongoose.model('Tribe');
      var User = mongoose.model('User');

      var getTribes = new Promise(function (resolve, reject) {
        Tribe.find(function (err, tribes) {
          if (err) {
            reject(err);
          }
          resolve(tribes);
        });
      });

      getTribes.then(function (tribes) {

        console.log(chalk.white('--'));
        console.log(chalk.green('Trustroots test user data'));
        console.log(chalk.white('--'));

        (function addNextUser(){
          var user = new User();
          var admin;

          // Check if this is an admin user
          if (numAdminUsers > 0) {
            admin = adminUsers[adminUsers.length - numAdminUsers];
          }

          // Add mock data
          user.firstName = faker.name.firstName();
          user.lastName = faker.name.lastName();
          user.displayName = user.firstName + ' ' + user.lastName;
          user.provider = 'local';
          user.public = true;
          user.avatarUploaded = false;
          user.avatarSource = 'none';
          user.welcomeSequenceStep = 3;
          user.seen = moment()
            .subtract(Math.random() * 365, 'd')
            .subtract(Math.random() * 24, 'h')
            .subtract(Math.random() * 3600, 's');

          if (admin !== undefined) {
            // admin user
            user.email = 'admin+' + admin + '@example.com';
            user.password = 'password123';
            user.username = admin;
          }
          else {
            // non admin user
            user.email = index + faker.internet.email();
            user.password = faker.internet.password();
            user.username = index + user.displayName.toLowerCase().replace('\'', '').replace(' ', '');
          }

          // Add the user to tribes
          if (tribes.length > 0) {
            var userNumTribes = random(tribes.length);

            // Randomize indecies
            var randomTribes = [];
            for (var i = 0; i < tribes.length; i++) {
              randomTribes[i] = i;
            }
            randomTribes = _.shuffle(randomTribes);

            // Add the tribes using the random indecies
            for (var j = 0; j < userNumTribes; j++) {
              var rand = randomTribes[j];
              user.member.push({ tribe: tribes[rand]._id, since: Date.now() });
              tribes[rand].count += 1;
              Tribe.findByIdAndUpdate(tribes[rand]._id, tribes[rand], function (err) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }

          // Save the user
          user.save(function (err) {
            if (admin!== undefined) {
              console.log('Created admin user. Login with: ' + admin + ' / password');
            } else if (err && admin !== undefined) {
              console.log(chalk.red('Could not add admin user ' + admin));
              console.log(err);
            } else if (err) {
              console.log(err);
            }
          });

          index++;
          addOffer(user._id, index, max);

          // No more admin users
          if (numAdminUsers === 1) {
            printWarning();
          }

          if (admin !== undefined) {
            numAdminUsers--;
          }

          if (index < max) {
            addNextUser();
          }
        }());

        while (numAdminUsers > 0) {

        }
      });
    });
  });
}; // addUsers()

// Number of users is required
if (process.argv[2] == null) {
  console.log(chalk.red('Usage: node fillTestData.js <number of users to add> {user names}'));
} else {
  // Parse optional admin users
  var numberOfUsers = process.argv[2];
  var adminUsers = [];
  for (var i = 3; i < process.argv.length; i++) {
    if (process.argv[i] !== null) {
      adminUsers.push(process.argv[i]);
    }
  }
  // Add users
  if (adminUsers.length > 0) {
    addUsers(numberOfUsers, adminUsers);
  } else {
    addUsers(numberOfUsers);
  }
}
