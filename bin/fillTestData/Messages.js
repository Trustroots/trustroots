'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    argv = require('yargs')
      .usage('Usage: $0 <number of threads to add> <max messages per thread> {options}')
      .boolean('verbose')
      .describe('verbose', 'Enable extra database output (default=false)')
      .demandCommand(2)
      .example('node $0 100 10', 'Adds 100 random threads wth up to 10 messages per thread to the database')
      .example('node $0 100 10 --verbose', 'Adds 100 random threads wth up to 10 messages per thread to the database with verbose database output')
      .check(function (argv) {
        if (argv._[0] < 1) {
          throw new Error('Error: Number of threads should be greater than 0');
        }
        else if (argv._[1] < 1) {
          throw new Error('Error: Max messages per thread should be greater than 0');
        }
        return true;
      })
      .strict()
      .argv,
    faker = require('faker'),
    mongoose = require('mongoose'),
    config = require(path.resolve('./config/config'));

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var addDays = function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

var addThreads = function () {
  var index = 0;
  var numThreads = argv._[0];
  var maxMessages= argv._[1];
  var verbose = (argv.verbose === true);

  console.log('Generating ' + numThreads + ' messages...');
  if (numThreads > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  if (verbose) {
    console.log(chalk.white('--'));
    console.log(chalk.green('Trustroots test tribes data'));
    console.log(chalk.white('--'));
  }

  // Override debug mode to use the option set by the user
  config.db.debug = verbose;

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

// Add messages
addThreads();
