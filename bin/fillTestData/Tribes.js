'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    mongoose = require('mongoose');

var tribeImageUUIDs = [
  '171433b0-853b-4d19-a8b4-44def956696d',
  '22028fde-5302-4172-954d-f54949afd7e4',
  'e69eb05f-773f-423c-9246-43629b5a8baf',
  '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6c',
  'd5563f29-669f-4f18-9802-d1924ff31364',
  '4ff6463d-c482-4be6-9a49-294fc8712d83',
  'e4466aa6-46f1-460f-94ef-8cec882d7103',
  '12a2c124-a38a-4df8-8987-e01ee3741727',
  'e23060e2-393d-4b4a-b469-450053538f8a',
  '6274fd88-9178-4cea-8bb4-60f22e4cc904',
  'fb2b6d50-9d51-4755-9b44-1395fae4cf5d',
  '656e4872-15a4-4be4-8059-6e7c39b07c5d',
  'e060263a-9684-4065-85f3-460e9fffbd40',
  'ad2062d0-aadd-475d-bf85-2cd2e30a9d38',
  'bfaf468a-2c48-4798-b1bb-bffd0c6b716b',
  '0fd49df4-88e7-4380-b38a-3625e4b02dde',
  'cef34c15-b527-4f89-a7a5-456f62ff9ce2',
  'c84f93f1-421d-4339-a61f-a5efc2d24297',
  'd4a04ce4-3aeb-43a4-882b-43b1974d86e0',
  '310f68af-3e77-451e-96a7-09132d26fdb4',
  'dcb0ed04-cdd6-45ea-b773-e09320a4f759',
  '434018c8-4f4f-4054-9bd2-6618e9d5a77f',
  '0ce0abdf-6898-4191-9a86-4f03807291b5',
  '0ebcabec-2bc5-4eee-ab17-991b9dd52eae',
  '4f7805e7-b5e6-4b40-bb32-3aafbe1bbc74',
  '69a500a4-a16e-4c4d-9981-84fbe310d531'
];

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
        tribe.image_UUID = _.sample(tribeImageUUIDs);
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
