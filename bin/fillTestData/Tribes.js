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
  '$0 <numberOfCircles>',
  'Seed database with number of circles',
  yargs => {
    return yargs
      .positional('numberOfCircles', {
        describe: 'Number of circles to add',
        type: 'number',
      })
      .boolean('debug')
      .boolean('limit')
      .describe('debug', 'Enable extra database output (default=false)')
      .describe(
        'limit',
        'If circles already exist in the database, only add up to the number of circles (default=false)',
      )
      .example(
        'node $0 1000',
        'Adds 1000 randomly seeded circles to the database',
      )
      .example(
        'node $0 100 --debug',
        'Adds 100 randomly seeded circles to the database with debug database output',
      )
      .example(
        'node $0 100 --limit',
        'Adds up to 100 randomly seeded circles to the database (eg. If 20 circles already exist, 80 circles will be added)',
      )
      .check(function (argv) {
        if (argv.numberOfCircles < 1) {
          throw new Error('Error: Number of circles should be greater than 0');
        }
        return true;
      })
      .strict().yargs;
  },
).argv;

/**
 * Hardcoded circle image ids stored on the CDN used for seeding. These were
 * last updated 2018-10-20
 */
const circleImageUUIDs = [
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
  '69a500a4-a16e-4c4d-9981-84fbe310d531',
];

/**
 * Seeds an individual circle with fake data. Circle names are appended with circleIndex
 * to guarantee uniqueness.
 *
 * @param {object} circle  The circle to seed.
 * @param {number} circleIndex - index to add to the circle label
 * @returns {object} Returns the seeded circle object
 */
function seedCircle(circle, circleIndex) {
  circle.label = faker.lorem.word() + '_' + circleIndex;
  circle.labelHistory = faker.random.words();
  circle.slugHistory = faker.random.words();
  circle.synonyms = faker.random.words();
  circle.color = faker.internet.color().slice(1);
  circle.count = 0;
  circle.created = Date.now();
  circle.modified = Date.now();
  circle.public = true;
  circle.image_UUID = _.sample(circleImageUUIDs);
  circle.attribution = faker.name.findName();
  circle.attribution_url = faker.internet.url();
  circle.description = faker.lorem.sentences();
  return circle;
}

/**
 * This the the main method that seeds all the circles. Based on the limit
 * parameter it determines how many circles to add. It adds the new circles
 * and prints status accordingly.
 */
function seedCircles() {
  let index = 0;
  const max = argv.numberOfCircles;
  const debug = argv.debug === true;
  const limit = argv.limit === true;

  // Display number of circles to add
  console.log('Generating ' + max + ' circles...');
  if (max > 2000) {
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
      const Tribe = mongoose.model('Tribe');

      /**
       * Adds the number of circles using the values and options specified
       * by the user
       *
       * @param {number} initialCircleCount - The number of circles prior to adding
       * any new circles
       * @returns {Promise} Promise that completes when all circles have
       *  successfully been added.
       */
      function addCircles(initialCircleCount) {
        return new Promise(resolve => {
          let savedCircles = 0;

          // handle the limit option
          if (limit) {
            index = initialCircleCount;
          }

          // if we already hit the limit
          if (index >= max) {
            console.log(
              chalk.green(
                initialCircleCount +
                  ' circles already exist. No circles created!',
              ),
            );
            console.log(chalk.white('')); // Reset to white
            resolve();
          }

          // Add circles until we reach the total
          while (index < max) {
            const circle = new Tribe();

            // seed the circle data
            seedCircle(circle, initialCircleCount + index);

            // save the newly created circle
            circle.save(err => {
              if (err != null) {
                console.log(err);
              } else {
                // Circle was saved successfully
                process.stdout.write('.');
                savedCircles += 1;

                // If all circles have been saved print a summary and
                // resolve the promise.
                if (
                  (limit && savedCircles + initialCircleCount >= max) ||
                  (!limit && savedCircles >= max)
                ) {
                  console.log('');
                  console.log(
                    chalk.green(
                      initialCircleCount + ' circles existed in the database.',
                    ),
                  );
                  console.log(
                    chalk.green(savedCircles + ' circles successfully added.'),
                  );
                  console.log(
                    chalk.green(
                      'Database now contains ' +
                        (initialCircleCount + savedCircles) +
                        ' circles.',
                    ),
                  );
                  console.log(chalk.white('')); // Reset to white
                  resolve();
                }
              }
            });
            index += 1;
          }
        }); // Promise
      }

      // This is the main sequence to add the circles.
      //    * First get the current number of circles from the database
      //    * Then seed all the new circles
      try {
        const circleCount = await Tribe.countDocuments();
        await addCircles(circleCount);
      } catch (err) {
        console.log(err);
      }

      // Disconnect from the database
      mongooseService.disconnect();
    });
  });
}

seedCircles();
