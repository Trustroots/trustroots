'use strict';

var path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    mongoose = require('mongoose');

require(path.resolve('./modules/tribes/server/model/tribe.server.model'));

var Tribe = mongoose.model('Tribe');

console.log(chalk.white('--'));
console.log(chalk.green('Trustroots test tribes data'));
console.log(chalk.white('--'));

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var addTribes = function (index, max) {
  var tribe = new Tribe();

  tribe.label = faker.random.word();
  tribe.labelHistory = faker.random.words();
  tribe.slugHistory = faker.random.words();
  tribe.synonyms = faker.random.words();
  tribe.color = faker.internet.color().slice(1);
  tribe.count = 0;
  tribe.created = Date.now();
  tribe.modified = Date.now();
  tribe.public = true;
  // tribe.image_UUID = faker.random.uuid();
  tribe.attribution = faker.name.findName();
  tribe.attribution_url = faker.internet.url();
  tribe.description = faker.lorem.sentences();

  tribe.save(function (err) {
    if (err != null) {
      console.log(err);
    }
    else {
      if (index >= max) {
        console.log(chalk.green('Done with ' + max + ' test tribes!'));
        console.log(chalk.white('')); // Reset to white
        process.exit(0);
      }
    }
  });

  index+=1;
  if (index < max) {
    addTribes(index, max);
  }
};

// Number of tribes is required
if (process.argv[2] == null) {
  console.log(chalk.red('Usage node Please give a number of tribes to add.'));
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
      addTribes(0, numberOfTribes);
    });
  });
}
