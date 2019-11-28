/**
 * A script that goes trough all past user signups and pushes them as an event to InfluxDB
 *
 * Run:
 * ```
 * NODE_ENV=production node ./scripts/influxdb/fill-signups-to-influx.js
 * ```
 *
 * Dry run by passing `--dry` argument:
 *
 * ```
 * NODE_ENV=production node ./scripts/influxdb/fill-signups-to-influx.js --dry
 * ```
 */

/**
 * Script dependencies
 */
var path = require('path'),
    async = require('async'),
    mongoose = require('mongoose'),
    argv = require('yargs').argv,
    mongooseHelper = require(path.resolve('./config/lib/mongoose')),
    statService = require(path.resolve('./modules/stats/server/services/stats.server.service'));

require(path.resolve('./modules/users/server/models/user.server.model'));

var User = mongoose.model('User');

// Dry run?
if (argv.dry) {
  console.log('---');
  console.warn('Dry run, this won\'t save anything to Influx!');
  console.log('---');
}

// Query to fetch documents from the DB
var query = {
  created: {
    // The date when feature was pushed to production
    $lt: new Date('2017-03-21T21:28:00')
  }
};

async.waterfall([

  function connectMongo(done) {
    // Connect to MongoDB
    mongooseHelper.connect(function() {
      done();
    });
  },

  // count all docs to be able to show progress
  function countAll(done) {
    User.count(query).exec(function (err, count) {
      done(err, count);
    });
  },

  function findAndProcess(count, done) {

    // Nothing found
    if (count === 0) {
      console.log('---');
      console.warn('No documents to process!');
      console.log('---');
      return done(null, 0, 0);
    }

    console.log('Found ' + count + ' documents\n');
    console.log('Processing and adding the records to Influx now\n');

    // settings how often the progress will be printed to console
    // every PROGRESS_INTERVAL %
    var PROGRESS_INTERVAL = 0.1; // percent
    var progress = 0; // progress counter

    var q = async.queue(function (doc, callback) {

      // showing a progress
      if (progress % Math.ceil(count / 100 * PROGRESS_INTERVAL) === 0) {
        // update the progress instead of logging to newline
        var progressPercent = (progress / count * 100).toFixed(1);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(
          progressPercent + '% (' + progress + '/' + count + ')'
        );
      }
      ++progress;

      // processing and saving the point to stats
      if (argv.dry) {
        // Don't push to stats (dry run)
        callback();
      } else {
        // Push to stats for real
        statService.stat({
          namespace: 'signup',
          time: new Date(doc.created),
          counts: {
            count: 1
          },
          tags: {
            status: 'success'
          }
        }, callback);
      }

    }, 5); // How many docs to process at once?

    // Get docs and start processing them
    User.find(query).exec(function (err, docs) {
      q.push(docs);
    });

    // Done with all docs
    q.drain = function() {
      if (progress === count) {
        return done(null, progress, count);
      }
    };

  }
], function (err, processedCount, totalCount) {
  // finish writing the progress bar
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write((Math.floor(processedCount / totalCount * 100) || 100) + '% (' + processedCount + '/' + totalCount + ') (done)\n\n');

  if (err) {
    console.log('Error:');
    console.error(err);
    return;
  }

  // Disconnect DB
  mongooseHelper.disconnect(function(disconnectErr) {
    if (disconnectErr) {
      console.log('Could not disconnect MongoDB.');
      console.error(disconnectErr);
    }

    console.log('All done!');
    process.exit(1);
  });

});
