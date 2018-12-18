'use strict';

var _ = require('lodash'),
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
    cities = JSON.parse(fs.readFileSync(path.resolve('./bin/fillTestData/data/Cities.json'), 'utf8')),
    savedUsers = 0,
    savedOffers = 0;

require(path.resolve('./modules/offers/server/models/offer.server.model'));

var argv = yargs.usage('$0 <numberOfUsers>', 'Seed database with number of tribes', function (yargs) {
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

var Offer = mongoose.model('Offer');

var random = function (max) {
  return Math.floor(Math.random() * max);
};

var randomizeLoaction = function () {
  var random = Math.random();
  if (random > 0.98) {
    random = ((Math.random() - 0.5) * Math.random() * 4) - 1;
  } else {
    random = random / 10000 - 0.00005;
  }
  return parseFloat(random.toFixed(5));
};

var printSummary = function (countExisting, countSaved) {
  console.log('');
  console.log(chalk.green(countExisting + ' users existed in the database.'));
  console.log(chalk.green(countSaved + ' users successfully added.'));
  console.log(chalk.green('Database now contains ' + (countExisting + countSaved) + ' users.'));
  console.log(chalk.white(''));
};

var addOffer = function (id, index, max, usersLength, limit, callback) {
  var offer = new Offer();

  var city = cities[random(cities.length)];
  var lat = city.lat + randomizeLoaction();
  var lon = city.lon + randomizeLoaction();
  var location = [lat, lon];

  offer.type = 'host';
  offer.status = _.sample(['yes', 'maybe']);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = id;
  offer.location = location;
  offer.locationFuzzy = location;

  offer.save(function (err) {
    if (err != null) console.log(err);
    else {
      savedOffers++;
      // Exit if we have completed saving all users and offers
      if ((limit && (savedUsers + usersLength >= max && savedOffers + usersLength >= max))
          || ((!limit && (savedUsers >= max && savedOffers >= max)))) {
        printSummary(usersLength, savedUsers);
        callback(null, null);
        process.exit(0);
      }
    }
  });
};

var addUsers = function () {
  var index = 0;
  var numAdminUsers;
  var debug = (argv.debug === true);
  var limit = (argv.limit === true);
  var max = argv.numberOfUsers;
  var adminUsers = argv.userNames;

  if (adminUsers === null || adminUsers === undefined) {
    numAdminUsers = 0;
  } else {
    numAdminUsers = adminUsers.length;
  }

  var printWarning = function printWarning() {
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
  mongooseService.connect(function () {
    mongooseService.loadModels(function () {
      var Tribe = mongoose.model('Tribe');
      var User = mongoose.model('User');

      async.waterfall([
        function (done) {
          User.find(function (err, users) {
            if (err) {
              done(err, null);
            }
            done(null, users);
          });
        },

        function (users, done) {
          if (limit) {
            index = users.length;
          }

          if (index >= max) {
            console.log(chalk.green(users.length + ' users already exist. No users created!'));
            console.log(chalk.white('')); // Reset to white
            process.exit(0);
          }

          var getTribes = new Promise(function (resolve, reject) {
            Tribe.find(function (err, tribes) {
              if (err) {
                reject(err);
              }
              resolve(tribes);
            });
          });

          getTribes.then(function (tribes) {

            console.log(chalk.white('--'));
            console.log(chalk.green('Trustroots test user data'));
            console.log(chalk.white('--'));

            while (index < max) {
              (function addNextUser(){
                var user = new User();
                var admin;

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
                  user.username = index + user.displayName.toLowerCase().replace('\'', '').replace(' ', '');
                }

                // Add the user to tribes
                if (tribes.length > 0) {
                  var userNumTribes = random(tribes.length);

                  // Randomize indecies
                  var randomTribes = [];
                  for (var i = 0; i < tribes.length; i++) {
                    randomTribes[i] = i;
                  }
                  randomTribes = _.shuffle(randomTribes);

                  // Add the tribes using the random indecies
                  for (var j = 0; j < userNumTribes; j++) {
                    var rand = randomTribes[j];
                    user.member.push({ tribe: tribes[rand]._id, since: Date.now() });
                    tribes[rand].count += 1;
                    Tribe.findByIdAndUpdate(tribes[rand]._id, tribes[rand], function (err) {
                      if (err) {
                        console.error(err);
                      }
                    });
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
          }).catch(function (err) {
            console.log(err);
            done(err, null);
          });
        }
      ]);


    });
  });
}; // addUsers()

addUsers();
