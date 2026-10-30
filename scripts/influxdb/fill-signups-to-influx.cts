import type {
  ConnectionHelper,
  CountUsers,
  LegacyMongoose,
} from '../legacy-cli-contracts.d.cts';
/**
 * A script that goes trough all past user signups and pushes them as an event to InfluxDB
 *
 * Run:
 * ```
 * NODE_ENV=production node ./scripts/influxdb/fill-signups-to-influx.cts
 * ```
 *
 * Dry run by passing `--dry` argument:
 *
 * ```
 * NODE_ENV=production node ./scripts/influxdb/fill-signups-to-influx.cts --dry
 * ```
 */

/**
 * Script dependencies
 */
const mongoose = require('mongoose') as LegacyMongoose;
const argv = require('yargs/yargs')(process.argv.slice(2)).parseSync() as {
  dry?: unknown;
};
const mongooseHelper =
  require('./../../config/lib/mongoose.mjs') as ConnectionHelper;
const statService =
  require('./../../modules/stats/server/services/stats.server.service.mts') as typeof import('../../modules/stats/server/services/stats.server.service.mts').default;

const { forEachWithConcurrency } =
  require('./../../modules/core/server/services/task-queue.server.service.mts') as typeof import('../../modules/core/server/services/task-queue.server.service.mts').default;

require('./../../modules/users/server/models/user.server.model.mjs');

const User = mongoose.model<CountUsers>('User');

// Dry run?
if (argv.dry) {
  console.log('---');
  console.warn("Dry run, this won't save anything to Influx!");
  console.log('---');
}

// Query to fetch documents from the DB
const query = {
  created: {
    // The date when feature was pushed to production
    $lt: new Date('2017-03-21T21:28:00'),
  },
};

function finish(err: unknown, processedCount?: number, totalCount?: number) {
  // finish writing the progress bar
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(
    (Math.floor((Number(processedCount) / Number(totalCount)) * 100) || 100) +
      '% (' +
      processedCount +
      '/' +
      totalCount +
      ') (done)\n\n',
  );

  if (err) {
    console.log('Error:');
    console.error(err);
    return;
  }

  // Disconnect DB
  mongooseHelper.disconnect(function (disconnectErr) {
    if (disconnectErr) {
      console.log('Could not disconnect MongoDB.');
      console.error(disconnectErr);
    }

    console.log('All done!');
    process.exit(1);
  });
}

async function fillSignups() {
  // Connect to MongoDB
  await new Promise<void>(function (resolve) {
    mongooseHelper.connect(function () {
      resolve();
    });
  });

  // count all docs to be able to show progress
  let count: number;
  try {
    count = await User.countDocuments(query);
  } catch (err) {
    return finish(err, 0);
  }

  // Nothing found
  if (count === 0) {
    console.log('---');
    console.warn('No documents to process!');
    console.log('---');
    return finish(null, 0, 0);
  }

  console.log('Found ' + count + ' documents\n');
  console.log('Processing and adding the records to Influx now\n');

  // settings how often the progress will be printed to console
  // every PROGRESS_INTERVAL %
  const PROGRESS_INTERVAL = 0.1; // percent
  let progress = 0; // progress counter

  const processDoc = function (doc: CountUsers) {
    // showing a progress
    if (progress % Math.ceil((count / 100) * PROGRESS_INTERVAL) === 0) {
      // update the progress instead of logging to newline
      const progressPercent = ((progress / count) * 100).toFixed(1);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(
        progressPercent + '% (' + progress + '/' + count + ')',
      );
    }
    ++progress;

    return new Promise<void>(function (resolve) {
      // processing and saving the point to stats
      if (argv.dry) {
        // Don't push to stats (dry run)
        resolve();
      } else {
        // Push to stats for real; a failed write doesn't stop the others
        statService.stat(
          {
            namespace: 'signup',
            time: new Date(doc.created.getTime()),
            counts: {
              count: 1,
            },
            tags: {
              status: 'success',
            },
          },
          function () {
            resolve();
          },
        );
      }
    });
  };

  // Get docs and process at most 5 of them at once
  const docs = await User.find(query).exec();
  await forEachWithConcurrency(docs, 5, processDoc);

  // Done with all docs
  if (progress === count) {
    finish(null, progress, count);
  }
}

void fillSignups();
