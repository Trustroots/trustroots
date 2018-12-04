'use strict';

var _ = require('lodash'),
    path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    yargs = require('yargs'),
    faker = require('faker'),
    mongoose = require('mongoose'),
    async = require('async'),
    config = require(path.resolve('./config/config'));

var argv = yargs.usage('$0 <numberOfThreads> <maxMessages>',
  'Seed database with number of threads with up to max messages per thread',
  function (yargs) {
    return yargs
      .positional('numberOfThreads', {
        describe: 'Number of threads to add',
        type: 'number'
      })
      .positional('maxMessages', {
        describe: 'Maximum number of messages per thread to add',
        type: 'number'
      })
      .boolean('debug')
      .boolean('limit')
      .describe('debug', 'Enable extra database output (default=false)')
      .describe('limit', 'If threads already exist in the database, only add up to the number of threads (default=false)')
      .example('$0 100 10', 'Adds 100 random threads wth up to 10 messages per thread to the database')
      .example('$0 100 10 --debug', 'Adds 100 random threads wth up to 10 messages per thread to the database with debug database output')
      .example('$0 10 5 --limit', 'Adds up to 10 randomly seeded threads to the database with up to 5 message per thread (eg. If 5 threads already exist, 5 threads will be added)')
      .check(function (argv) {
        if (argv.numberOfThreads < 1) {
          throw new Error('Error: Number of threads should be greater than 0');
        }
        else if (argv.maxMessages < 1) {
          throw new Error('Error: Max messages per thread should be greater than 0');
        }
        return true;
      })
      .strict().yargs;
  })
  .argv;

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
  var numThreads = argv.numberOfThreads;
  var maxMessages= argv.maxMessages;
  var debug = (argv.debug === true);
  var limit = (argv.limit === true);

  console.log('Generating ' + numThreads + ' messages...');
  if (numThreads > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test tribes data'));
  console.log(chalk.white('--'));

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  // Bootstrap db connection
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Thread = mongoose.model('Thread');
      var Message = mongoose.model('Message');
      var User = mongoose.model('User');

      async.waterfall([
        function (done) {
          Thread.find(function (err, threads) {
            if (err) {
              done(err, null);
            }
            done(null, threads);
          });
        },

        function (threads, done) {
          if (limit) {
            index = threads.length;
          }

          if (index >= numThreads) {
            console.log(chalk.green(threads.length + ' threads already exist. No threads created!'));
            console.log(chalk.white('')); // Reset to white
            process.exit(0);
          }

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

            while (index < numThreads) {
              var threadsSaved = 0;

              (function addNextMessageThread() {
                var messageThread = new Thread;
                var messageCount = random(maxMessages) + 1;
                var messageIndex = messageCount;
                var to,
                    from;

                while (messageIndex > 0) {
                  function addNextMessage(depth, userTo, userFrom) {
                    var message = new Message();

                    message.created = addDays(Date.now(), -depth + 1);
                    message.content = faker.lorem.sentences();

                    // Randomize indecies
                    var randomUsers = [];
                    for (var i = 0; i < users.length; i++) {
                      randomUsers[i] = i;
                    }
                    randomUsers = _.shuffle(randomUsers);

                    if (userTo) {
                      message.userTo = userTo;
                    } else {
                      message.userTo = users[randomUsers[1]]._id;
                      to = message.userTo;
                    }
                    if (userFrom) {
                      message.userFrom = userFrom;
                    } else {
                      message.userFrom = users[randomUsers[0]]._id;
                      from = message.userFrom;
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
                      } else {
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
                              threadsSaved += 1;
                              if (threadsSaved >= numThreads) {
                                console.log(chalk.green('Done with ' + numThreads + ' test threads!'));
                                console.log(chalk.white('')); // Reset to white
                                process.exit(0);
                              }
                            }
                          });
                        }
                      }
                    });
                  };

                  if (messageIndex === messageCount) {
                    addNextMessage(messageIndex);
                  } else if (((messageIndex + 1) % 2) === 0) {
                    // Reverse the order of to and from to simulate a conversation going back and forth
                    addNextMessage(messageIndex, from, to);
                  } else if (((messageIndex + 1) % 2) === 1) {
                    addNextMessage(messageIndex, to, from);
                  }

                  messageIndex -=1;
                }
              }());
              index += 1;
            }

          }).catch(function (err) {
            console.log(err);
            done(err, null);
          });
          done(null, null);
        }
      ]);
    });
  });
};

// Add messages
addThreads();
