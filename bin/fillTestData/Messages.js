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

var addDays = function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

var addThreads = function (numThreads, maxMessages) {
  var index = 0;

  console.log('Generating ' + numThreads + ' messages...');
  if (numThreads > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test messages data'));
  console.log(chalk.white('--'));

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Thread = mongoose.model('Thread');
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

        if (users.length < 2) {
          console.log('Error: At least 2 users must exist to create message threads. Please create more users and run again');
          process.exit(1);
        }

        (function addNextMessageThread() {
          var messageThread = new Thread;
          var threadSize = random(maxMessages) + 1;

          (function addNextMessage(depth, to, from) {
            var message = new Message();

            message.created = addDays(Date.now(), -depth + 1);
            message.content = faker.lorem.sentences();

            // Randomize indecies
            var randomUsers = [];
            for (var i = 0; i < users.length; i++) {
              randomUsers[i] = i;
            }
            randomUsers = _.shuffle(randomUsers);

            if (to) {
              message.userTo = to;
            } else {
              message.userTo = users[randomUsers[1]]._id;
            }
            if (from) {
              message.userFrom = from;
            } else {
              message.userFrom = users[randomUsers[0]]._id;
            }

            // Assume 80% of messages are read
            if (random(100) < 80) {
              message.read = true;
            } else {
              message.read = false;
            }

            message.notificationCount = 0;

            message.save(function (err) {
              if (err != null) {
                console.log(err);
              }
            });

            // Add thread for the most recent message
            if (depth === 1) {
              messageThread.updated = message.created;
              messageThread.userFrom = message.userFrom;
              messageThread.userTo = message.userTo;
              messageThread.message = message._id;
              messageThread.read = true;
              messageThread.save(function (err) {
                if (err != null) {
                  console.log(err);
                }
                else {
                  console.log('index ' + index);
                  if (index >= numThreads) {
                    console.log(chalk.green('Done with ' + numThreads + ' test threads!'));
                    console.log(chalk.white('')); // Reset to white
                    process.exit(0);
                  }
                }
              });
            }

            depth-=1;
            if (depth > 0) {
              // Reverse the order of to and from to simulate a conversation going back and forth
              addNextMessage(depth, message.userFrom, message.userTo);
            }

          }(threadSize));

          index+=1;
          if (index < numThreads) {
            addNextMessageThread();
          }
        }());

      }).catch(function (err) {
        console.log(err);
      });
    });
  });
};

// Number of threads and max number of messages is required
if (process.argv[2] == null || process.argv[2] < 1 || process.argv[3]== null || process.argv[3] < 1) {
  console.log(chalk.red('Usage: node fillTestMessageData <number of threads to add> <max messages per thread>'));
} else {

  var numberOfThreads = process.argv[2];
  var maxMessages= process.argv[3];

  // Add messages
  addThreads(numberOfThreads, maxMessages);
}
