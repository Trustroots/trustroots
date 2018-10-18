'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    faker = require('faker'),
    mongoose = require('mongoose');

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var addMessages = function (max) {
  var index = 0;

  console.log('Generating ' + max + ' messages...');
  if (max > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test messages data'));
  console.log(chalk.white('--'));

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Message = mongoose.model('Message');
      var User = mongoose.model('User');

      var getUsers = new Promise(function (resolve, reject) {
        User.find(function (err, users) {
          if (err) {
            reject(err);
          }
          resolve(users);
        });
      });

      getUsers.then(function (users) {
        (function addSingleMessage() {
          var message = new Message();

          console.log('Adding single message');
          message.created = Date.now();
          message.content = faker.lorem.sentences();

          // Randomize indecies
          var randomUsers = [];
          for (var i = 0; i < users.length; i++) {
            randomUsers[i] = i;
          }
          randomUsers = _.shuffle(randomUsers);

          message.userFrom = users[randomUsers[0]]._id;
          message.userTo = users[randomUsers[1]]._id;

          // Assume 80% of messages are read
          if (random(100) < 80) {
            message.read = true;
          } else {
            message.read = false;
          }
          // REVISIT - JSK - Add notification count
          // message.notificationCount = faker.internet.color().slice(1);

          message.save(function (err) {
            if (err != null) {
              console.log(err);
            }
            else {
              console.log('index ' + index);
              if (index >= max) {
                console.log(chalk.green('Done with ' + max + ' test messages!'));
                console.log(chalk.white('')); // Reset to white
                process.exit(0);
              }
            }
          });

          index+=1;
          if (index < max) {
            addSingleMessage();
          }
        }());

      }).catch(function (err) {
        console.log(err);
      });
    });
  });
};

// Number of messages is required
if (process.argv[2] == null || process.argv[2] < 1) {
  console.log(chalk.red('Usage: node fillTestMessageData <number of messages to add>'));
} else {

  var numberOfMessages= process.argv[2];
  // Add messages
  addMessages(numberOfMessages);
}
