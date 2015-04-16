'use strict';

var init = require('../config/init')(),
    config = require('../config/config'),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    models = require('../app/models/user'),
    models = require('../app/models/offer'),
    User = mongoose.model('User'),
    Offer = mongoose.model('Offer'),
    faker = require('faker'),
    fs = require('fs'),
    cities = JSON.parse(fs.readFileSync('scripts/fillTestDataCities.json', 'utf8')),
    status = ["yes", "maybe"],
    savedCounter = 0;

console.log('Filling test data...');

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var randomizeLoaction = function () {
  var random =  Math.random();
  if(random > 0.98) {
    random = ((Math.random()-0.5)*Math.random()*4)-1;
  }
  else {
    random = random/10000 - 0.00005;
  }
  return parseFloat(random.toFixed(5));
};

// Bootstrap db connection
var db = mongoose.connect(config.db.uri, function(err) {
  if (err) {
    console.error('\x1b[31m', 'Could not connect to MongoDB!');
    console.log(err);
  }
});

var addUsers = function (index, max) {
  var user = new User();

  user.firstName = faker.name.firstName();
  user.lastName = faker.name.lastName();
  user.displayName = user.firstName + ' ' + user.lastName;
  user.provider = 'local';
  user.public = true;
  user.avatarUploaded = false;
  user.avatarSource = 'none';
  user.email = index+faker.internet.email();
  user.password = faker.internet.password();
  user.username = index+user.firstName.toLowerCase().replace('\'', '');

  user.save(function(err) {
    if(err != null) console.log(err);
  });
  index++;
  addOffer(user._id, index, max);

  if(index <= max) {
    addUsers(index, max);
  }

};

var addOffer = function (id, index, max) {
  var offer = new Offer();

  var city = cities[random(cities.length)];
  var lat = city.lat + randomizeLoaction();
  var lon = city.lon + randomizeLoaction();
  var location = [lat, lon];

  offer.status = _.sample(status);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = id;
  offer.location = location;
  offer.locationFuzzy = location;

  offer.save(function(err) {
    if(err != null) console.log(err);
    else {
      savedCounter++;
      if(savedCounter >= max) {
        console.log('Done with ' + max + ' dummy users!');
        process.exit(0);
      }
    }
  });
}

// Create optional admin user
var adminUsername = (process.argv[3] == null) ? false : process.argv[3];

// Number of users is required
if(process.argv[2] == null) {
  console.log("Please give a number of users to add");
}
else {
  var numberOfUsers = process.argv[2];

  // Create admin user + regular users
  if(adminUsername !== false) {
    var adminUser = new User();

    adminUser.firstName = faker.name.firstName();
    adminUser.lastName = faker.name.lastName();
    adminUser.displayName = adminUser.firstName + ' ' + adminUser.lastName;
    adminUser.provider = 'local';
    adminUser.email = 'admin+' + adminUsername + '@example.tld';
    adminUser.password = 'password';
    adminUser.username = adminUsername;
    adminUser.avatarSource = 'none';
    adminUser.public = true;
    adminUser.avatarUploaded = false;

    adminUser.save(function(err) {
      if(!err) {
        console.log('Created admin user. Login with: ' + adminUsername + ' / password');
      } else {
        console.log('Could not add admin user ' + adminUsername)
        console.log(err);
      }

      // Add regular users
      console.log('Generating ' + numberOfUsers + ' users...');
      if(numberOfUsers > 2000) {
        console.log('...this might really take a while... go grab some coffee!');
      }
      addUsers(1, numberOfUsers);
    });
  }
  else {
    // Add regular users
    console.log('Generating ' + numberOfUsers + ' users...');
    if(numberOfUsers > 2000) {
      console.log('...this might really take a while... go grab some coffee!');
    }
    addUsers(0, numberOfUsers);
  }

}
