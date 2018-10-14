'use strict';

var _ = require('lodash'),
    path = require('path'),
    moment = require('moment'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    cities = JSON.parse(fs.readFileSync(path.resolve('./scripts/fillTestDataCities.json'), 'utf8')),
    savedCounter = 0;

require(path.resolve('./modules/users/server/models/user.server.model'));
require(path.resolve('./modules/offers/server/models/offer.server.model'));
require(path.resolve('./modules/tribes/server/models/tribe.server.model'));

var User = mongoose.model('User');
var Offer = mongoose.model('Offer');
var Tribe = mongoose.model('Tribe');

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots test data'));
console.log(chalk.white('--'));

var random = function (max) {
  return Math.floor(Math.random() * max);
};

// Fisher-Yates shuffle algorith taken from:
// https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
var shuffle = function shuffle(a) {
  var j,
      x,
      i;
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return a;
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

var addUsers = function (index, max, tribes) {
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
  user.seen = moment()
    .subtract(Math.random() * 365, 'd')
    .subtract(Math.random() * 24, 'h')
    .subtract(Math.random() * 3600, 's');

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
      tribes[rand].count +=1;
      Tribe.findByIdAndUpdate(tribes[rand]._id, tribes[rand], function (err) {
        if (err) {
          console.error(err);
        }
      });
    }
  }

  if (tribes.length > 0) {
    var userNumTribes = random(tribes.length);

    // Randomize indecies
    var randomTribes = [];
    for (var i = 0; i < tribes.length; i++) {
      randomTribes[i] = i;
    }
    randomTribes = shuffle(randomTribes);

    // Add the tribes using the random indecies
    for (var j = 0; j < userNumTribes; j++) {
      var rand = randomTribes[j];
      user.member.push({ tribe: tribes[rand]._id, since: Date.now() });
      tribes[rand].count +=1;
      Tribe.findByIdAndUpdate(tribes[rand]._id, tribes[rand], function (err) {
        if (err) {
          console.error(err);
        }
      });
    }
  }

  user.save(function (err) {
    if (err) {
      console.log(err);
    }
  });
  index++;
  addOffer(user._id, index, max);

  if (index <= max) {
    addUsers(index, max, tribes);
  }

};

// Create optional admin user
var adminUsername = (process.argv[3] == null) ? false : process.argv[3];

// Number of users is required
if (process.argv[2] == null) {
  console.log(chalk.red('Please give a number of users to add.'));
} else {

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {

      var numberOfUsers = process.argv[2];


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

          adminUser.save(function (err) {
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
            addUsers(1, numberOfUsers, tribes);
          });
        } else {
        // Add regular users
          console.log('Generating ' + numberOfUsers + ' users...');
          if (numberOfUsers > 2000) {
            console.log('...this might really take a while... go grab some coffee!');
          }
          addUsers(0, numberOfUsers, tribes);
        }

      }).catch(function (err){
        console.log(err);
      });
    });
  });
}
