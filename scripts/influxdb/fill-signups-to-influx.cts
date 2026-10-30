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

async function fillSignups(): Promise<[number, number]> {
  await new Promise<void>(resolve => mongooseHelper.connect(() => resolve()));
  const count = await User.countDocuments(query);
  if (!count) {
    console.warn('No documents to process!');
    return [0, 0];
  }
  const docs = await User.find(query).exec();
  const PROGRESS_INTERVAL = 0.1;
  let progress = 0;
  let nextDoc = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (nextDoc < docs.length) {
        const doc = docs[nextDoc++];
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

        if (!argv.dry)
          await new Promise<void>(resolve => {
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
              () => resolve(),
            );
          });
      }
    }),
  );
  return [progress, count];
}
function finish(
  err?: unknown,
  processedCount?: number,
  totalCount?: number,
): void {
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
fillSignups().then(
  ([processed, total]) => finish(null, processed, total),
  err => finish(err),
);
