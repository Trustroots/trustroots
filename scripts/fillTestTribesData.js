'use strict';

var path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    mongoose = require('mongoose');

require(path.resolve('./modules/tribes/server/models/tribe.server.model'));

var Tribe = mongoose.model('Tribe');

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots test tribes data'));
console.log(chalk.white('--'));

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var addTribes = function (max) {
  var tribe = new Tribe();

  for (var i = 0; i < max; i++) {
    tribe.label = faker.name.firstName();
    tribe.labelHistory = faker.name.lastName();
    tribe.slugHistory = tribe.firstName + ' ' + tribe.lastName;
    tribe.synonyms = 'local';
    tribe.color = true;
    tribe.count = false;
    tribe.created = faker.date();
    tribe.public = true;
    tribe.image_UUID = faker.internet.password();
    tribe.attribution = i + tribe.displayName.toLowerCase().replace('\'', '').replace(' ', '');
    tribe.attribution_url = faker.attribution_url();
    tribe.description = faker.lorem.sentence();

    tribe.save(function (err) {
      if (err) {
        console.log(err);
      }
    });
    i++;
  }
};

// Number of tribes is required
if (process.argv[2] == null) {
  console.log(chalk.red('Please give a number of tribes to add.'));
} else {

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var numberOfTribes= process.argv[2];
      // Add tribes
      console.log('Generating ' + numberOfTribes + ' users...');
      if (numberOfTribes > 2000) {
        console.log('...this might really take a while... go grab some coffee!');
      }
      addTribes(numberOfTribes);
    });
  });
}
