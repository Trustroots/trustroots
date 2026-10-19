import mongooseService from './../../config/lib/mongoose.mjs';
import yargs from 'yargs';
import { faker } from '@faker-js/faker';
import mongoose, { type Document } from 'mongoose';
import config from './../../config/config.mts';

interface SeedCircleRecord extends Document {
  label: string;
  labelHistory: string;
  slugHistory: string;
  synonyms: string;
  color: string;
  count: number;
  created: number;
  modified: number;
  public: boolean;
  attribution: string;
  attribution_url: string;
  description: string;
}
/**
 * Required dependencies
 */

/**
 * Configure the script usage using yargs to obtain parameters and enforce usage.
 */
const argv = yargs(process.argv.slice(2))
  .usage('$0 <numberOfCircles>')
  .command('$0 <numberOfCircles>', 'Seed database with circles')
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
  .example('node $0 1000', 'Adds 1000 randomly seeded circles to the database')
  .example(
    'node $0 100 --debug',
    'Adds 100 randomly seeded circles to the database with debug database output',
  )
  .example(
    'node $0 100 --limit',
    'Adds up to 100 randomly seeded circles to the database (eg. If 20 circles already exist, 80 circles will be added)',
  )
  .check(function (argv) {
    if (typeof argv.numberOfCircles !== 'number' || argv.numberOfCircles < 1) {
      throw new Error('Error: Number of circles should be greater than 0');
    }
    return true;
  })
  .strict()
  .parseSync();

const numberOfCircles = argv.numberOfCircles;
if (typeof numberOfCircles !== 'number') {
  throw new Error('Error: Number of circles should be greater than 0');
}

/**
 * Seeds an individual circle with fake data. Circle names are appended with circleIndex
 * to guarantee uniqueness.
 *
 * @param {object} circle  The circle to seed.
 * @param {number} circleIndex - index to add to the circle label
 * @returns {object} Returns the seeded circle object
 */
function seedCircle(circle: SeedCircleRecord, circleIndex: number) {
  circle.label = faker.lorem.word() + '_' + circleIndex;
  circle.labelHistory = faker.lorem.words();
  circle.slugHistory = faker.lorem.words();
  circle.synonyms = faker.lorem.words();
  circle.color = faker.color.rgb({ format: 'hex', prefix: '' });
  circle.count = 0;
  circle.created = Date.now();
  circle.modified = Date.now();
  circle.public = true;
  circle.attribution = faker.person.fullName();
  circle.attribution_url = faker.internet.url();
  circle.description = faker.lorem.sentences();
  return circle;
}

/**
 * This the the main method that seeds all the circles. Based on the limit
 * parameter it determines how many circles to add. It adds the new circles
 * and prints status accordingly.
 */
function seedCircles(max: number) {
  let index = 0;
  const debug = argv.debug === true;
  const limit = argv.limit === true;

  // Display number of circles to add
  console.log('Generating ' + max + ' circles...');
  if (max > 2000) {
    console.log('...this might really take a while... go grab some coffee!');
  }
  console.log('--');
  console.log('Trustroots test circles data');
  console.log('--');

  // Override debug mode to use the option set by the user
  config.db.debug = debug;

  // Bootstrap db connection
  mongooseService.connect(() => {
    mongooseService.loadModels(async () => {
      const Tribe = mongoose.model<SeedCircleRecord>('Tribe');

      /**
       * Adds the number of circles using the values and options specified
       * by the user
       *
       * @param {number} initialCircleCount - The number of circles prior to adding
       * any new circles
       * @returns {Promise} Promise that completes when all circles have
       *  successfully been added.
       */
      function addCircles(initialCircleCount: number) {
        return new Promise<void>(resolve => {
          let savedCircles = 0;

          // handle the limit option
          if (limit) {
            index = initialCircleCount;
          }

          // if we already hit the limit
          if (index >= max) {
            console.log(
              initialCircleCount +
                ' circles already exist. No circles created!',
            );
            resolve();
          }

          // Add circles until we reach the total
          while (index < max) {
            const circle = new Tribe();

            // seed the circle data
            seedCircle(circle, initialCircleCount + index);

            // save the newly created circle
            circle
              .save()
              .then(() => {
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
                    initialCircleCount + ' circles existed in the database.',
                  );
                  console.log(savedCircles + ' circles successfully added.');
                  console.log(
                    'Database now contains ' +
                      (initialCircleCount + savedCircles) +
                      ' circles.',
                  );
                  resolve();
                }
              })
              .catch(err => {
                console.log(err);
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
seedCircles(numberOfCircles);
