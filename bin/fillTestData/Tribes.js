/**
 * Required dependencies
 */
const _ = require('lodash'),
      path = require('path'),
      mongooseService = require(path.resolve('./config/lib/mongoose')),
      chalk = require('chalk'),
      yargs = require('yargs'),
      faker = require('faker'),
      mongoose = require('mongoose'),
      config = require(path.resolve('./config/config'));

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs.usage('$0 <numberOfTribes>', 'Seed database with number of tribes', (yargs) => {
  return yargs
    .positional('numberOfTribes', {
      describe: 'Number of tribes to add',
      type: 'number'
    })
    .boolean('debug')
    .boolean('limit')
    .describe('debug', 'Enable extra database output (default=false)')
    .describe('limit', 'If tribes already exist in the database, only add up to the number of tribes (default=false)')
    .example('node $0 1000', 'Adds 1000 randomly seeded tribes to the database')
    .example('node $0 100 --debug', 'Adds 100 randomly seeded tribes to the database with debug database output')
    .example('node $0 100 --limit', 'Adds up to 100 randomly seeded tribes to the database (eg. If 20 tribes already exist, 80 tribes will be added)')
    .check(function (argv) {
      if (argv.numberOfTribes < 1) {
        throw new Error('Error: Number of tribes should be greater than 0');
      }
      return true;
    })
    .strict().yargs;
}).argv;


/**
 * Hardcoded tribe image ids stored on the CDN used for seeding. These were
 * last updated 2018-10-20
 */
const tribeImageUUIDs = [
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

/**
 * Seeds an individual tribe with fake data. Tribe names are appended with tribeIndex
 * to guarantee uniqueness.
 *
 * @param {object} tribe  The tribe to seed.
 * @param {number} tribeIndex - index to add to the tribe label
 * @returns {object} Returns the seeded tribe object
 */
function seedTribe(tribe, tribeIndex) {

  tribe.label = faker.lorem.word() + '_' + tribeIndex;
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
  return tribe;

} // seedTribe()


/**
 * This the the main method that seeds all the tribes. Based on the limit
 * parameter it determines how many tribes to add. It adds the new tribes
 * and prints status accordingly.
 */
function seedTribes() {
  let index = 0;
  const max = argv.numberOfTribes;
  const debug = (argv.debug === true);
  const limit = (argv.limit === true);

  // Display number of tribes to add
  console.log('Generating ' + max + ' tribes...');
  if (max > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }

  console.log(chalk.white('--'));
  console.log(chalk.green('Trustroots test tribes data'));
  console.log(chalk.white('--'));

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  // Bootstrap db connection
  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Tribe = mongoose.model('Tribe');

      /**
      * Adds the number of tribes using the values and options specified
      * by the user
      *
      * @param {number} initialTribeCount - The number of tribes prior to adding
      * any new tribes
      * @returns {Promise} Promise that completes when all tribes have
      *  successfully been added.
      */
      function addTribes(initialTribeCount) {
        return new Promise((resolve) => {
          let savedTribes = 0;

          // handle the limit option
          if (limit) {
            index = initialTribeCount;
          }

          // if we already hit the limit
          if (index >= max) {
            console.log(chalk.green(initialTribeCount + ' tribes already exist. No tribes created!'));
            console.log(chalk.white('')); // Reset to white
            resolve();
          }

          // Add tribes until we reach the total
          while (index < max) {
            let tribe = new Tribe();

            // seed the tribe data
            seedTribe(tribe, initialTribeCount + index);

            // save the newly created tribe
            tribe.save((err) => {

              if (err != null) {
                console.log(err);
              }
              else {
                // Tribe was saved successfully
                process.stdout.write('.');
                savedTribes += 1;

                // If all tribes have been saved print a summary and
                // resolve the promise.
                if ((limit && (savedTribes + initialTribeCount >= max))
                    || !limit && ((savedTribes >= max))) {
                  console.log('');
                  console.log(chalk.green(initialTribeCount + ' tribes existed in the database.'));
                  console.log(chalk.green(savedTribes + ' tribes successfully added.'));
                  console.log(chalk.green('Database now contains ' + (initialTribeCount + savedTribes) + ' tribes.'));
                  console.log(chalk.white('')); // Reset to white
                  resolve();
                }
              }

            });
            index += 1;
          }
        }); // Promise
      } // addAllTribes()


      // This is the main sequence to add the tribes.
      //    * First get the current number of tribes from the database
      //    * Then seed all the new tribes
      try {
        const tribeCount = await Tribe.countDocuments();
        await addTribes(tribeCount);
      } catch (err) {
        console.log(err);
      }

      // Disconnect from the database
      mongooseService.disconnect();

    }); // monggooseService.loadModels
  }); // mongooseService.connect
} // seedTribes

seedTribes();

