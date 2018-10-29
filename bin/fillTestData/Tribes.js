'use strict';

var path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    fs = require('fs'),
    tribesData = JSON.parse(fs.readFileSync(path.resolve('./bin/fillTestData/data/Tribes.json'), 'utf8')),
    mongoose = require('mongoose');

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var addTribes = function (max) {
  var index = 0;

  // Add tribes
  console.log('Generating ' + max + ' tribes...');
  if (max > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test tribes data'));
  console.log(chalk.white('--'));

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Tribe = mongoose.model('Tribe');

      (function addNextTribe() {
        var tribe = new Tribe();

        tribe.label = faker.random.word() + '_' + index;
        tribe.labelHistory = faker.random.words();
        tribe.slugHistory = faker.random.words();
        tribe.synonyms = faker.random.words();
        tribe.color = faker.internet.color().slice(1);
        tribe.count = 0;
        tribe.created = Date.now();
        tribe.modified = Date.now();
        tribe.public = true;
        tribe.image_UUID = tribesData[random(tribesData.length)].image_UUID;
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
          addNextTribe();
        }
      }());
    });
  });
};

// Number of tribes is required
if (process.argv[2] == null || process.argv[2] < 1) {
  console.log(chalk.red('Usage: node fillTestTribesData.js <number of tribes to add>'));
} else {
  var numberOfTribes= process.argv[2];
  addTribes(numberOfTribes);
}
