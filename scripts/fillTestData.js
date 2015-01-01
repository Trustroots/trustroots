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
    fs = require('fs');

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var status = ["yes", "maybe"];

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
var db = mongoose.connect(config.db, function(err) {
  if (err) {
    console.error('\x1b[31m', 'Could not connect to MongoDB!');
    console.log(err);
  }
});

var fs = require('fs');
var cities = JSON.parse(fs.readFileSync('scripts/cities.json', 'utf8'));

var addUsers = function (index, max) {
  var user = new User();

  user.firstName = faker.name.firstName();
  user.lastName = faker.name.lastName();
  user.displayName = user.firstName + ' ' + user.lastName;
  user.provider = 'local';
  user.public = true;
  user.avatarSource = 'none';
  user.email = index+faker.internet.email();
  user.password = faker.internet.password();
  user.username = index+user.firstName.toLowerCase()

  user.save(function(err) {
    if(err != null) console.log(err);
  });
  index++;
  addOffer(user._id, index, max);

  if(index <= max) {
    addUsers(index, max);
  }

}

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
      saved++;
      if(saved >= max) {
        console.log("Finished! Log in with trout/password");
        process.exit(0);
      }
    }
  });
}

var saved = 0;

if(process.argv[2] == null) {
  console.log("Please give a number of users to add");
}
else {

  var user = new User();

  user.firstName = faker.name.firstName();
  user.lastName = faker.name.lastName();
  user.displayName = user.firstName + ' ' + user.lastName;
  user.provider = 'local';
  user.email = 'admin@email.com';
  user.password = 'password';
  user.username = 'trout';
  user.avatarSource = 'none';
  user.public = true;

  user.save(function(err) {
    if(!err) {
      var numberOfUsers = process.argv[2];
      var i = 1;
      console.log("Let's go!");
      console.log("Don't be in a hurry. Trust the trout.");
      addUsers(i, numberOfUsers);
    }
    else {
      console.log(err);
    }
  });
}
