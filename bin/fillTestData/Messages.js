/**
 * Required dependencies
 */
const _ = require('lodash');
const path = require('path');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const chalk = require('chalk');
const yargs = require('yargs');
const faker = require('faker');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs.usage(
  '$0 <numberOfThreads> <maxMessages>',
  'Seed database with number of threads with up to max messages per thread',
  yargs => {
    return yargs
      .positional('numberOfThreads', {
        describe: 'Number of threads to add',
        type: 'number',
      })
      .positional('maxMessages', {
        describe: 'Maximum number of messages per thread to add',
        type: 'number',
      })
      .boolean('debug')
      .boolean('limit')
      .describe('debug', 'Enable extra database output (default=false)')
      .describe(
        'limit',
        'If threads already exist in the database, only add up to the number of threads (default=false)',
      )
      .example(
        '$0 100 10',
        'Adds 100 random threads wth up to 10 messages per thread to the database',
      )
      .example(
        '$0 100 10 --debug',
        'Adds 100 random threads wth up to 10 messages per thread to the database with debug database output',
      )
      .example(
        '$0 10 5 --limit',
        'Adds up to 10 randomly seeded threads to the database with up to 5 message per thread (eg. If 5 threads already exist, 5 threads will be added)',
      )
      .check(argv => {
        if (argv.numberOfThreads < 1) {
          throw new Error('Error: Number of threads should be greater than 0');
        } else if (argv.maxMessages < 1) {
          throw new Error(
            'Error: Max messages per thread should be greater than 0',
          );
        }
        return true;
      })
      .strict().yargs;
  },
).argv;

/**
 * This generates a random integer between 0 and max - 1 inclusively
 *
 * @param {number} max The max value to use to generate the random integer
 * @returns random integer between 0 and max - 1
 */
function random(max) {
  return Math.floor(Math.random() * max);
}

/**
 * Adds number of days to the date and returns a new date
 *
 * @param {Date} date
 * @param {number} days
 * @returns {Date} the new date object
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * This the the main method that seeds all the message threads. Based on the
 * limit parameter and the number of threads and messages options, it
 * determines how many new message threads to add. It then adds the
 * threads and prints status accordingly.
 */
function seedThreads() {
  let index = 0;
  const numThreads = argv.numberOfThreads;
  const maxMessages = argv.maxMessages;
  const debug = argv.debug === true;
  const limit = argv.limit === true;

  console.log('Generating ' + numThreads + ' message threads...');
  if (numThreads > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test circles data'));
  console.log(chalk.white('--'));

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  // Bootstrap db connection
  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Thread = mongoose.model('Thread');
      const Message = mongoose.model('Message');
      const User = mongoose.model('User');

      /**
       * Adds the number of threads using the values and options specified
       * by the user
       *
       * @param {number} initialThreadCount
       * @returns {Promise} Promise that completes when all message threads have
       *  successfully been added.
       */
      function addThreads(initialThreadCount) {
        // @TODO: valid lint issue that should be fixed
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          let threadsSaved = 0;

          // handle the limit option
          if (limit) {
            index = initialThreadCount;
          }

          // if we already hit the limit
          if (index >= numThreads) {
            console.log(
              chalk.green(
                initialThreadCount +
                  ' message threads already exist. No threads created!',
              ),
            );
            console.log(chalk.white('')); // Reset to white
            resolve();
            return;
          }

          // Get the users
          const users = await User.find();

          // If we don't have enough users in the database
          if (users.length < 2) {
            reject(
              'Error: At least 2 users must exist to create message threads. Please create more users and run again',
            );
            return;
          }

          // Add threads until we reach the total
          while (index < numThreads) {
            const messageCount = random(maxMessages) + 1;
            let messageIndex = messageCount;
            let to;
            let from;

            // Add messages until we reach the total
            while (messageIndex > 0) {
              // @TODO: valid lint issue that should be fixed
              // eslint-disable-next-line no-inner-declarations
              function addMessage(depth, userTo, userFrom) {
                const message = new Message();

                message.created = addDays(Date.now(), -depth + 1);
                message.content = faker.lorem.sentences();

                // Randomize indecies
                let randomUsers = [];
                for (let i = 0; i < users.length; i++) {
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

                // save the newly created message
                message.save(err => {
                  if (err != null) {
                    console.log(err);
                  } else {
                    // Message was saved successfully

                    // Add thread for the most recent message
                    if (depth === 1) {
                      const messageThread = new Thread();

                      // seed the message thread data
                      seedThread(messageThread, message);

                      // save the message thread
                      messageThread.save(err => {
                        if (err != null) {
                          console.log(err);
                        } else {
                          // Thread was saved successfully
                          process.stdout.write('.');
                          threadsSaved += 1;

                          // If all threads have been saved print a summary and
                          // resolve the promise.
                          if (
                            (limit &&
                              threadsSaved + initialThreadCount >=
                                numThreads) ||
                            (!limit && threadsSaved >= numThreads)
                          ) {
                            console.log('');
                            console.log(
                              chalk.green(
                                initialThreadCount +
                                  ' message threads existed in the database.',
                              ),
                            );
                            console.log(
                              chalk.green(
                                threadsSaved +
                                  ' message threads successfully added.',
                              ),
                            );
                            console.log(
                              chalk.green(
                                'Database now contains ' +
                                  (initialThreadCount + threadsSaved) +
                                  ' message threads.',
                              ),
                            );
                            console.log(chalk.white('')); // Reset to white
                            resolve();
                            return;
                          }
                        }
                      }); // messageThread.save
                    }
                  }
                }); // message.save
              } // addNextMessage

              if (messageIndex === messageCount) {
                addMessage(messageIndex);
              } else if ((messageIndex + 1) % 2 === 0) {
                // Reverse the order of to and from to simulate a conversation going back and forth
                addMessage(messageIndex, from, to);
              } else if ((messageIndex + 1) % 2 === 1) {
                addMessage(messageIndex, to, from);
              }

              messageIndex -= 1;
            }
            index += 1;
          }
        }); // Promise
      } // addThreads

      // This is the main sequence to add the message threads.
      //    * First get the current number of threads from the database
      //    * Then seed all the new threads
      try {
        const initialThreadCount = await Thread.countDocuments();
        await addThreads(initialThreadCount);
      } catch (err) {
        console.log(err);
      }

      // Disconnect from the database
      mongooseService.disconnect();
    }); // monggooseService.loadModels
  }); // mongooseService.connect

  /**
   * Seed the message thread with fake data and data from the message.
   *
   * @param {Thread} thread
   * @param {Message} message
   * @returns
   */
  function seedThread(thread, message) {
    thread.updated = message.created;
    thread.userFrom = message.userFrom;
    thread.userTo = message.userTo;
    thread.message = message._id;
    thread.read = true;

    return thread;
  } // seedThread
} // seedThreads

seedThreads();
