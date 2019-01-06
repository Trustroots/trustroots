'use strict';

const _ = require('lodash'),
      path = require('path'),
      mongooseService = require(path.resolve('./config/lib/mongoose')),
      chalk = require('chalk'),
      yargs = require('yargs'),
      faker = require('faker'),
      fs = require('fs'),
      moment = require('moment'),
      mongoose = require('mongoose'),
      async = require('async'),
      config = require(path.resolve('./config/config')),
      cities = JSON.parse(fs.readFileSync(path.resolve('./bin/fillTestData/data/Cities.json'), 'utf8'));

let users = null,
    tribes = null,
    savedUsers = 0,
    savedOffers = 0;

require(path.resolve('./modules/offers/server/models/offer.server.model'));

const argv = yargs.usage('$0 <numberOfUsers>', 'Seed database with number of tribes', function (yargs) {
  return yargs
    .positional('numberOfUsers', {
      describe: 'Number of users to add',
      type: 'number'
    })
    .array('userNames')
    .boolean('debug')
    .boolean('limit')
    .describe('userNames', 'List of admin usernames')
    .describe('debug', 'Enable extra database output (default=false)')
    .describe('limit', 'If users already exist in the database, only add up to the number of users (default=false)')
    .example('node $0 1000', 'Adds 1000 randomly seeded users to the database')
    .example('node $0 100 --userNames admin1 admin2 admin3 --', 'Adds 100 randomly seeded users including usernames: admin1, admin2, and admin3 all using the password \'password123\'')
    .example('node $0 100 --debug', 'Adds 100 randomly seeded users to the database with debug database output')
    .example('node $0 100 --limit', 'Adds up to 100 randomly seeded users to the database (eg. If 20 users already exist, 80 users will be added)')
    .check(function (argv) {
      if (argv.numberOfUsers < 1) {
        throw new Error('Error: Number of users should be greater than 0');
      }
      return true;
    })
    .strict()
    .yargs;
}).argv;

const Offer = mongoose.model('Offer');

const random = function (max) {
  return Math.floor(Math.random() * max);
};

const randomizeLoaction = function () {
  let random = Math.random();
  if (random > 0.98) {
    random = ((Math.random() - 0.5) * Math.random() * 4) - 1;
  } else {
    random = random / 10000 - 0.00005;
  }
  return parseFloat(random.toFixed(5));
};

const printSummary = function (countExisting, countSaved) {
  console.log('');
  console.log(chalk.green(countExisting + ' users existed in the database.'));
  console.log(chalk.green(countSaved + ' users successfully added.'));
  console.log(chalk.green('Database now contains ' + (countExisting + countSaved) + ' users.'));
  console.log(chalk.white(''));
};

const addOffer = function (id, index, max, usersLength, limit, callback) {
  let offer = new Offer();

  let city = cities[random(cities.length)];
  let lat = city.lat + randomizeLoaction();
  let lon = city.lon + randomizeLoaction();
  let location = [lat, lon];

  offer.type = 'host';
  offer.status = _.sample(['yes', 'maybe']);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = id;
  offer.location = location;
  offer.locationFuzzy = location;

  offer.save((err) => {
    if (err != null) console.log(err);
    else {
      savedOffers++;
      // Exit if we have completed saving all users and offers
      if ((limit && (savedUsers + usersLength >= max && savedOffers + usersLength >= max))
          || ((!limit && (savedUsers >= max && savedOffers >= max)))) {
        printSummary(usersLength, savedUsers);
        callback(null);
      }
    }
  });
};

const addUsers = function () {
  let index = 0;
  let numAdminUsers;
  let debug = (argv.debug === true);
  let limit = (argv.limit === true);
  let max = argv.numberOfUsers;
  let adminUsers = argv.userNames;

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
    mongooseService.loadModels(() => {
      const Tribe = mongoose.model('Tribe');
      const User = mongoose.model('User');

      async.waterfall([

        function getUsersAndTribes(done) {
          const getUsers = User.find();
          const getTribes = Tribe.find();

          Promise.all([getUsers, getTribes]).then((results) => {
            users = results[0];
            tribes = results[1];
            done(null);
          }).catch(function (err) {
            console.log(err);
            done(err);
          });
        },

        function addAllUsers(done) {
          if (limit) {
            index = users.length;
          }

          if (index >= max) {
            console.log(chalk.green(users.length + ' users already exist. No users created!'));
            console.log(chalk.white('')); // Reset to white
            done(null);
            return;
          }

          console.log(chalk.white('--'));
          console.log(chalk.green('Trustroots test user data'));
          console.log(chalk.white('--'));

          while (index < max) {
            (function addNextUser(){
              let user = new User();
              let admin;

              // Check if this is an admin user
              if (numAdminUsers > 0) {
                admin = adminUsers[adminUsers.length - numAdminUsers];
              }

              // Add mock data
              user.firstName = faker.name.firstName();
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

              if (admin !== undefined) {
                // admin user
                user.email = 'admin+' + admin + '@example.com';
                user.password = 'password123';
                user.username = admin;
              }
              else {
                // non admin user
                user.email = index + faker.internet.email();
                user.password = faker.internet.password();
                user.username = index + user.displayName.toLowerCase().replace(/\'/g, '').replace(/\s/g, '');
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
                  let rand = randomTribes[j];
                  user.member.push({ tribe: tribes[rand]._id, since: Date.now() });
                  tribes[rand].count += 1;
                }
              }

              // Save the user
              user.save(function (err) {
                savedUsers++;
                process.stdout.write('.');

                if (!err && admin!== undefined) {
                  console.log('Created admin user. Login with: ' + admin + ' / password');
                } else if (err && admin !== undefined) {
                  console.log(chalk.red('Could not add admin user ' + admin));
                  console.log(err);
                } else if (err) {
                  console.log(err);
                }

                addOffer(user._id, index, max, users.length, limit, done);
              });


              // No more admin users
              if (numAdminUsers === 1) {
                printWarning();
              }

              if (admin !== undefined) {
                numAdminUsers--;
              }
            }());

            index++;
          }
        },

        // Update tribes with the new tribe counts once all users have been  added
        function updateTribes(done) {
          let numTribesUpdated = 0;

          // If we didn't add any users, tribes do not need to be updated
          if (savedUsers === 0) {
            done(null);
          } else {
            // Update tribes
            for (let j = 0; j < tribes.length; j++) {
              Tribe.findByIdAndUpdate(tribes[j]._id, tribes[j], (err) => {
                if (err) {
                  console.error(err);
                }

                numTribesUpdated += 1;
                if (tribes.length === numTribesUpdated) {
                  done(null);
                }
              });
            }
          }
        },

        // disconnect from mongo
        function disconnect(done) {
          mongooseService.disconnect(() => {
            done(null);
          });
        }

      ]); // asyc.waterfall

    });
  });
}; // addUsers()

addUsers();
