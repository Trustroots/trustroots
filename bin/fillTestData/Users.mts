import { readFileSync } from 'node:fs';
import _ from 'lodash';
import mongooseService from './../../config/lib/mongoose.mjs';
import yargs from 'yargs';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import mongoose, { type Document, type Types } from 'mongoose';
import config from './../../config/config.mjs';
import './../../modules/offers/server/models/offer.server.model.mjs';

interface City {
  lat: number;
  lon: number;
}

interface TribeRecord extends Document {
  count: number;
}

interface UserRecord extends Document {
  gender: string;
  firstName: string;
  lastName: string;
  displayName: string;
  provider: string;
  public: boolean;
  avatarUploaded: boolean;
  avatarSource: string;
  welcomeSequenceStep: number;
  seen: Date;
  languages: string[];
  member: { tribe: Types.ObjectId; since: number }[];
  email: string;
  password: string;
  username: string;
}

interface OfferRecord extends Document {
  type: string;
  status: 'yes' | 'maybe';
  description: string;
  maxGuests: number;
  user: Types.ObjectId;
  location: [number, number];
  locationFuzzy: [number, number];
}

function parseCities(value: unknown): City[] {
  if (!Array.isArray(value)) {
    throw new Error('Cities data must be an array');
  }
  const entries: unknown[] = value;
  const cities: City[] = [];
  for (const city of entries) {
    if (
      typeof city === 'object' &&
      city !== null &&
      'lat' in city &&
      typeof city.lat === 'number' &&
      'lon' in city &&
      typeof city.lon === 'number'
    ) {
      cities.push({ lat: city.lat, lon: city.lon });
    } else {
      throw new Error(
        'Cities data must contain numeric latitude and longitude',
      );
    }
  }
  return cities;
}

function parseLanguages(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Languages data must map language keys to names');
  }
  const languages: Record<string, string> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') continue;
    const language: unknown = Reflect.get(value, key);
    if (typeof language !== 'string') {
      throw new Error('Languages data must map language keys to names');
    }
    languages[key] = language;
  }
  return languages;
}

const cities = parseCities(
  JSON.parse(
    readFileSync(new URL('./data/Cities.json', import.meta.url), 'utf8'),
  ),
);
const languages = parseLanguages(
  JSON.parse(
    readFileSync(
      new URL('../../config/languages/languages.json', import.meta.url),
      'utf8',
    ),
  ),
);
/**
 * Required dependencies
 */

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs(process.argv.slice(2))
  .usage('$0 <numberOfUsers>')
  .command('$0 <numberOfUsers>', 'Seed database with users and offers')
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
  .example('node $0 1000', 'Adds 1000 randomly seeded users to the database')
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
  .check(function (arguments_) {
    if (
      typeof arguments_.numberOfUsers !== 'number' ||
      arguments_.numberOfUsers < 1
    ) {
      throw new Error('Error: Number of users should be greater than 0');
    }
    return true;
  })
  .strict()
  .parseSync();

const numberOfUsers = argv.numberOfUsers;
if (typeof numberOfUsers !== 'number') {
  throw new Error('Error: Number of users should be greater than 0');
}
const adminUserNames = argv.userNames?.map(userName => {
  if (typeof userName !== 'string') {
    throw new Error('Admin usernames must be strings');
  }
  return userName;
});

/**
 * Globals
 */
let savedUsers = 0;
let savedOffers = 0;
const Offer = mongoose.model<OfferRecord>('Offer');

/**
 * Generates a random integer between 0 and max - 1 inclusively
 *
 * @param {number} max The max value to use to generate the random integer
 * @returns random integer between 0 and max - 1
 */
function random(max: number) {
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
function printSummary(countExisting: number, countSaved: number) {
  console.log('');
  console.log(countExisting + ' users existed in the database.');
  console.log(countSaved + ' users successfully added.');
  console.log(
    'Database now contains ' + (countExisting + countSaved) + ' users.',
  );
  console.log('');
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
function addOffer(
  userID: Types.ObjectId,
  maxUsers: number,
  initialUserCount: number,
  limit: boolean,
  callback: () => void,
) {
  const offer = new Offer();
  const city = cities[random(cities.length)];
  if (!city) throw new Error('Cities data must not be empty');
  const lat = city.lat + randomizeLocation();
  const lon = city.lon + randomizeLocation();
  const location: [number, number] = [lat, lon];
  offer.type = 'host';
  offer.status = faker.helpers.arrayElement(['yes', 'maybe'] as const);
  offer.description = faker.lorem.sentence();
  offer.maxGuests = random(10);
  offer.user = userID;
  offer.location = location;
  offer.locationFuzzy = location;
  offer.save((err: Error | null) => {
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
        callback();
      }
    }
  });
}

/**
 * Seed and add all the users
 *
 */
function addUsers(max: number, adminUsers: string[] = []) {
  let index = 0;
  let numAdminUsers: number;
  const debug = argv.debug === true;
  const limit = argv.limit === true;
  numAdminUsers = adminUsers.length;
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
      const Tribe = mongoose.model<TribeRecord>('Tribe');
      const User = mongoose.model<UserRecord>('User');
      let userCount = 0;
      let tribes: TribeRecord[] = [];

      /**
       * Gets the users and tribes from the database and saves them into the
       * global variables
       *
       * @returns {Promise} Promise that completes when user and tribe data
       *  have successfully loaded into global variables.
       */
      function getUserCountAndTribes(): Promise<void> {
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
      function addAllUsers(): Promise<void> {
        return new Promise<void>(resolve => {
          if (limit) {
            index = userCount;
          }
          if (index >= max) {
            console.log(userCount + ' users already exist. No users created!');
            resolve();
            return;
          }
          console.log('--');
          console.log('Trustroots test user data');
          console.log('--');
          const genderPath = User.schema.path('gender');
          if (
            !('enumValues' in genderPath) ||
            !Array.isArray(genderPath.enumValues)
          ) {
            throw new Error('User gender schema must define enum values');
          }
          const genderValues = genderPath.enumValues.filter(
            (gender): gender is string => typeof gender === 'string',
          );
          while (index < max) {
            (function addNextUser() {
              const user = new User();
              let admin: string | undefined;

              // Check if this is an admin user
              if (numAdminUsers > 0) {
                admin = adminUsers[adminUsers.length - numAdminUsers];
              }

              // Add mock data
              user.gender = faker.helpers.arrayElement(genderValues);
              const gender =
                user.gender === 'female' || user.gender === 'male'
                  ? user.gender
                  : undefined;
              user.firstName = faker.person.firstName(gender);
              user.lastName = faker.person.lastName();
              user.displayName = user.firstName + ' ' + user.lastName;
              user.provider = 'local';
              user.public = true;
              user.avatarUploaded = false;
              user.avatarSource = 'none';
              user.welcomeSequenceStep = 3;
              user.seen = moment()
                .subtract(Math.random() * 365, 'd')
                .subtract(Math.random() * 24, 'h')
                .subtract(Math.random() * 3600, 's')
                .toDate();
              // 0-4 random languages
              user.languages = [...Array(random(4))].map(() =>
                faker.helpers.objectKey(languages),
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
                let randomTribes: number[] = [];
                for (let i = 0; i < tribes.length; i++) {
                  randomTribes[i] = i;
                }
                randomTribes = _.shuffle(randomTribes);

                // Add the tribes using the random indecies
                for (let j = 0; j < userNumTribes; j++) {
                  const rand = randomTribes[j];
                  const tribe = tribes[rand];
                  if (!tribe) throw new Error('Expected a selected tribe');
                  user.member.push({
                    tribe: tribe._id,
                    since: Date.now(),
                  });
                  tribe.count += 1;
                }
              }

              // Save the user
              user.save(function (err: Error | null) {
                savedUsers++;
                process.stdout.write('.');
                if (!err && admin !== undefined) {
                  console.log(
                    'Created admin user. Login with: ' + admin + ' / password',
                  );
                } else if (err && admin !== undefined) {
                  console.log('Could not add admin user ' + admin);
                  console.log(err);
                } else if (err) {
                  console.log(err);
                }
                addOffer(user._id, max, userCount, limit, () => resolve());
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
      function updateTribes(): Promise<void> {
        return new Promise<void>(resolve => {
          let numTribesUpdated = 0;

          // If we didn't add any users, tribes do not need to be updated
          if (savedUsers === 0 || tribes.length === 0) {
            resolve();
          } else {
            // Update tribes
            for (let j = 0; j < tribes.length; j++) {
              const tribe = tribes[j];
              if (!tribe) throw new Error('Expected a selected tribe');
              Tribe.findByIdAndUpdate(tribe._id, tribe, (err: Error | null) => {
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

addUsers(numberOfUsers, adminUserNames);
