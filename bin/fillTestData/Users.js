/**
 * Required dependencies
 */
const _ = require('lodash');
const path = require('path');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const chalk = require('chalk');
const yargs = require('yargs');
const faker = require('faker');
const moment = require('moment');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const cities = require(path.resolve('./bin/fillTestData/data/Cities.json'));
const languages = require(path.resolve('./config/languages/languages.json'));

require(path.resolve('./modules/offers/server/models/offer.server.model'));

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs.usage(
  '$0 <numberOfUsers>',
  'Seed database with number of tribes',
  function (yargs) {
    return yargs
      .positional('numberOfUsers', {
        describe: 'Number of users to add',
        type: 'number',
      })
      .array('userNames')
      .boolean('debug')
      .boolean('limit')
      .describe('userNames', 'List of admin usernames')
      .describe('debug', 'Enable extra database output (default=false)')
      .describe(
        'limit',
        'If users already exist in the database, only add up to the number of users (default=false)',
      )
      .example(
        'node $0 1000',
        'Adds 1000 randomly seeded users to the database',
      )
      .example(
        'node $0 100 --userNames admin1 admin2 admin3 --',
        "Adds 100 randomly seeded users including usernames: admin1, admin2, and admin3 all using the password 'password123'",
      )
      .example(
        'node $0 100 --debug',
        'Adds 100 randomly seeded users to the database with debug database output',
      )
      .example(
        'node $0 100 --limit',
        'Adds up to 100 randomly seeded users to the database (eg. If 20 users already exist, 80 users will be added)',
      )
      .check(function (argv) {
        if (argv.numberOfUsers < 1) {
          throw new Error('Error: Number of users should be greater than 0');
        }
        return true;
      })
      .strict().yargs;
  },
).argv;

/**
 * Globals
 */
let savedUsers = 0;
let savedOffers = 0;
const Offer = mongoose.model('Offer');

/**
 * Generates a random integer between 0 and max - 1 inclusively
 *
 * @param {number} max The max value to use to generate the random integer
 * @returns random integer between 0 and max - 1
 */
function random(max) {
  return Math.floor(Math.random() * max);
}

/**
 * Generates a random float value for locations
 *
 * @returns {float}
 */
function randomizeLocation() {
  let random = Math.random();
  if (random > 0.98) {
    random = (Math.random() - 0.5) * Math.random() * 4 - 1;
  } else {
    random = random / 10000 - 0.00005;
  }
  return parseFloat(random.toFixed(5));
}

/**
 * Prints the final summary of how many users were saved
 *
 * @param {number} countExisting
 * @param {number} countSaved
 */
function printSummary(countExisting, countSaved) {
  console.log('');
  console.log(chalk.green(countExisting + ' users existed in the database.'));
  console.log(chalk.green(countSaved + ' users successfully added.'));
  console.log(
    chalk.green(
      'Database now contains ' + (countExisting + countSaved) + ' users.',
    ),
  );
  console.log(chalk.white(''));
}

/**
 * Seeds an offer and adds it to the database. When the last offer
 * is saved calls the callback.
 *
 * @param {string} userID
 * @param {number} maxUsers
 * @param {number} initialUserCount
 * @param {boolean} limit
 * @param {function} callback
 */
function addOffer(userID, maxUsers, initialUserCount, limit, callback) {
  const offer = new Offer();

  const city = cities[random(cities.length)];
  const lat = city.lat + randomizeLocation();
  const lon = city.lon + randomizeLocation();
  const location = [lat, lon];

  offer.type = 'host';
  offer.status = _.sample(['yes', 'maybe']);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = userID;
  offer.location = location;
  offer.locationFuzzy = location;

  offer.save(err => {
    if (err != null) console.log(err);
    else {
      savedOffers++;
      // Exit if we have completed saving all users and offers
      if (
        (limit &&
          savedUsers + initialUserCount >= maxUsers &&
          savedOffers + initialUserCount >= maxUsers) ||
        (!limit && savedUsers >= maxUsers && savedOffers >= maxUsers)
      ) {
        printSummary(initialUserCount, savedUsers);
        callback(null);
      }
    }
  });
}

/**
 * Seed and add all the users
 *
 */
function addUsers() {
  let index = 0;
  let numAdminUsers;

  const debug = argv.debug === true;
  const limit = argv.limit === true;
  const max = argv.numberOfUsers;
  const adminUsers = argv.userNames;

  if (adminUsers === null || adminUsers === undefined) {
    numAdminUsers = 0;
  } else {
    numAdminUsers = adminUsers.length;
  }

  const printWarning = function printWarning() {
    console.log('Generating ' + max + ' users...');
    if (max > 2000) {
      console.log('...this might really take a while... go grab some coffee!');
    }
  };

  if (numAdminUsers === 0) {
    printWarning();
  }

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  // Bootstrap db connection
  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Tribe = mongoose.model('Tribe');
      const User = mongoose.model('User');

      let userCount = 0;
      let tribes = null;

      /**
       * Gets the users and tribes from the database and saves them into the
       * global variables
       *
       * @returns {Promise} Promise that completes when user and tribe data
       *  have successfully loaded into global variables.
       */
      function getUserCountAndTribes() {
        const getUserCount = User.countDocuments();
        const getTribes = Tribe.find();

        return Promise.all([getUserCount, getTribes])
          .then(results => {
            [userCount, tribes] = results;
          })
          .catch(function (err) {
            console.log(err);
          });
      } // getUsersAndTribes()

      /**
       * Adds the number of users using the options specified by the user
       *
       * @returns {Promise} Promise that completes when all users have
       *  successfully been added.
       */
      function addAllUsers() {
        return new Promise(resolve => {
          if (limit) {
            index = userCount;
          }

          if (index >= max) {
            console.log(
              chalk.green(
                userCount + ' users already exist. No users created!',
              ),
            );
            console.log(chalk.white('')); // Reset to white
            resolve();
            return;
          }

          console.log(chalk.white('--'));
          console.log(chalk.green('Trustroots test user data'));
          console.log(chalk.white('--'));

          const genderValues = User.schema.path('gender').enumValues;
          while (index < max) {
            (function addNextUser() {
              const user = new User();
              let admin;

              // Check if this is an admin user
              if (numAdminUsers > 0) {
                admin = adminUsers[adminUsers.length - numAdminUsers];
              }

              // Add mock data
              user.gender = faker.random.arrayElement(genderValues);
              user.firstName = faker.name.firstName(user.gender);
              user.lastName = faker.name.lastName();
              user.displayName = user.firstName + ' ' + user.lastName;
              user.provider = 'local';
              user.public = true;
              user.avatarUploaded = false;
              user.avatarSource = 'none';
              user.welcomeSequenceStep = 3;
              user.seen = moment()
                .subtract(Math.random() * 365, 'd')
                .subtract(Math.random() * 24, 'h')
                .subtract(Math.random() * 3600, 's');
              // 0-4 random languages
              user.languages = [...Array(random(4))].map(() =>
                faker.random.objectElement(languages, 'key'),
              );

              if (admin !== undefined) {
                // admin user
                user.email = 'admin+' + admin + '@example.com';
                user.password = 'password123';
                user.username = admin;
              } else {
                // non admin user
                user.email = index + faker.internet.email();
                user.password = faker.internet.password();
                user.username =
                  index +
                  user.displayName
                    .toLowerCase()
                    .replace(/'/g, '')
                    .replace(/\s/g, '');
              }

              // Add the user to tribes
              if (tribes.length > 0) {
                const userNumTribes = random(tribes.length);

                // Randomize indecies
                let randomTribes = [];
                for (let i = 0; i < tribes.length; i++) {
                  randomTribes[i] = i;
                }
                randomTribes = _.shuffle(randomTribes);

                // Add the tribes using the random indecies
                for (let j = 0; j < userNumTribes; j++) {
                  const rand = randomTribes[j];
                  user.member.push({
                    tribe: tribes[rand]._id,
                    since: Date.now(),
                  });
                  tribes[rand].count += 1;
                }
              }

              // Save the user
              user.save(function (err) {
                savedUsers++;
                process.stdout.write('.');

                if (!err && admin !== undefined) {
                  console.log(
                    'Created admin user. Login with: ' + admin + ' / password',
                  );
                } else if (err && admin !== undefined) {
                  console.log(chalk.red('Could not add admin user ' + admin));
                  console.log(err);
                } else if (err) {
                  console.log(err);
                }

                addOffer(user._id, max, userCount, limit, resolve);
              });

              // No more admin users
              if (numAdminUsers === 1) {
                printWarning();
              }

              if (admin !== undefined) {
                numAdminUsers--;
              }
            })();

            index++;
          }
        });
      } // addAllUsers()

      /**
       * Update tribes with the new tribe counts once all users have been  added
       *
       * @returns {Promise} Promise that completes when all the tribes have
       *  successfully been updated.
       */
      function updateTribes() {
        return new Promise(resolve => {
          let numTribesUpdated = 0;

          // If we didn't add any users, tribes do not need to be updated
          if (savedUsers === 0 || tribes.length === 0) {
            resolve();
          } else {
            // Update tribes
            for (let j = 0; j < tribes.length; j++) {
              Tribe.findByIdAndUpdate(tribes[j]._id, tribes[j], err => {
                if (err) {
                  console.error(err);
                }

                numTribesUpdated += 1;
                if (tribes.length === numTribesUpdated) {
                  resolve();
                }
              });
            }
          }
        });
      } // updateTribes()

      // This is the main sequence to add all the users.
      //    * First get the current number of users and tribe data
      //    * Then seed all the new users
      //    * Lastly update the number of users that were added to each tribe
      try {
        await getUserCountAndTribes();
        await addAllUsers();
        await updateTribes();

        // Disconnect from the database
        mongooseService.disconnect();
      } catch (err) {
        console.log(err);
      }
    });
  });
} // addUsers()

addUsers();
