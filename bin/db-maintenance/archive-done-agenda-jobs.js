#!/usr/bin/env node

/**
 * Archive done Agenda jobs from `agendaJobs` collection by moving them
 * to `agendaJobsArchived` collection.
 *
 * Make sure this collection exists before running this! Script won't create it.
 *
 * Usage:
 *
 *  npm run agenda-maintenance
 *
 * To reverse ALL the documents from archive back to live db:
 *
 *  npm run agenda-maintenance -- reverse
 */

const MongoClient = require('mongodb').MongoClient;
const path = require('path');
const chalk = require('chalk');
const async = require('async');
const config = require(path.resolve('./config/config'));

let dbConnection;
let sourceCollection;
let targetCollection;
const filter = { nextRunAt: null, lockedAt: null };
let total;

const isReverse = process.argv[2] === 'reverse';

// By default from live to achived, but if requested "reverse" do Archived → back to live
const sourceCollectionName = isReverse ? 'agendaJobsArchived' : 'agendaJobs';
const targetCollectionName = isReverse ? 'agendaJobs' : 'agendaJobsArchived';

if (isReverse) {
  console.log(
    chalk.red('🚨 Reverse action! Movind docs from archive back to live.'),
  );
}

function countTotals(done) {
  sourceCollection
    .find()
    .count()
    .then(
      function (sourceCount) {
        console.log('\nSource count: ' + sourceCount);
        targetCollection
          .find()
          .count()
          .then(
            function (targetCount) {
              console.log('Target count: ' + targetCount);
              console.log('Total: ' + (sourceCount + targetCount) + '\n');
              done();
            },
            function (err) {
              console.log(
                'Could not get count of documents in target collection: ' +
                  targetCollectionName,
              );
              console.error(err);
            },
          );
      },
      function (err) {
        console.log(
          'Could not get count of documents in source collection: ' +
            sourceCollectionName,
        );
        console.error(err);
      },
    );
}

function moveDoc(doc, callback) {
  if (doc) {
    // Process doc
    insertDocument(doc, function (err) {
      if (err) {
        return callback(err);
      }
      removeDocument(doc, function (err) {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    });
  }
}

function insertDocument(doc, callback) {
  targetCollection.insertOne(doc, callback);
}

function removeDocument(doc, callback) {
  sourceCollection.deleteOne(doc, callback);
}

async.waterfall(
  [
    // Connect
    function (done) {
      // Use connect method to connect to the server
      MongoClient.connect(config.db.uri, function (err, db) {
        if (err) {
          console.log(chalk.red('Could not connect to MongoDB!'));
          return done(err);
        }

        dbConnection = db;

        console.log(chalk.green('Connected to MongoDB:'), config.db.uri);

        (sourceCollection = dbConnection.collection(sourceCollectionName)),
          (targetCollection = dbConnection.collection(targetCollectionName));

        done();
      });
    },

    // Count total
    function (done) {
      console.log('Counting docs...');
      sourceCollection
        .find(filter)
        .count()
        .then(function (count) {
          total = count;
          if (total <= 0) {
            console.log('No documents to transfer.');
            process.exit(0);
            return;
          }

          console.log(
            'Going to move ' +
              total +
              ' documents from ' +
              sourceCollectionName +
              ' to ' +
              targetCollectionName +
              '\n',
          );
          done();
        });
    },

    // Show how many docs each collection has currently
    function (done) {
      if (total <= 0) {
        return done();
      }
      countTotals(done);
    },

    // Fetch docs and get the cursor
    function (done) {
      if (total <= 0) {
        return done(null, null);
      }

      console.log('Fetching docs for transfer...\n');
      // cursor for streaming from mongoDB
      sourceCollection.find(filter, function (err, cursor) {
        done(null, cursor);
      });
    },

    // process docs
    function (cursor, done) {
      // preparation for async.doWhilst function
      //
      // settings how often the progress will be printed to console
      // every PROGRESS_INTERVAL %
      const PROGRESS_INTERVAL = 0.1; // percent
      let keepGoing = true;
      let progress = 1; // progress counter

      // this is the test for async.doWhilst
      const testKeepGoing = function () {
        return keepGoing;
      };

      // here we process the doc and print progress sometimes
      function saveMessageAndRunCounter(doc, callback) {
        // updating the message stat
        moveDoc(doc, function (err) {
          if (err) {
            return callback(err);
          }

          // showing the progress sometimes
          if (progress % Math.ceil((total / 100) * PROGRESS_INTERVAL) === 0) {
            // update the progress instead of logging to newline
            const progressPercent = ((progress / total) * 100).toFixed(1);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(
              '~' + progressPercent + '% (' + progress + '/' + total + ')',
            );
          }
          ++progress;

          return callback();
        });
      }

      // the iteratee (function to run in each step) of async.doWhilst
      function processNext(callback) {
        // getting the next message from mongodb
        cursor.next(function (err, msg) {
          // We've passed the end of the cursor
          if (!msg) {
            console.log('\nDone with the queue');
            keepGoing = false;
            return callback();
          }

          if (err) {
            console.log('\nCursor.next error:');
            console.error(err);
            return callback(err);
          }

          saveMessageAndRunCounter(msg, callback);
        });
      }

      // callback for the end of the script
      function processDocsFinish(finihsErr) {
        if (finihsErr) {
          console.error(finihsErr);
        }

        cursor.close().then(
          function () {
            console.log('\nCursor closed.');
            done(null, progress);
          },
          function (err) {
            console.log('\nFailed to close cursor at the end of the script:');
            console.error(err);
            done(null, progress);
          },
        );
        return;
      }

      // No docs to process, exit early
      if (total <= 0) {
        console.log('\nNo docs to process.');
        return processDocsFinish();
      }

      console.log('\nProcessing ' + total + ' docs...');

      async.doWhilst(processNext, testKeepGoing, processDocsFinish);
    },

    // Show how many docs each collection has currently
    function (progress, done) {
      if (total <= 0) {
        return done();
      }
      countTotals(function () {
        done(null, progress);
      });
    },
  ],
  function (err, totalProcessed) {
    if (err) {
      console.log('\nFinal error:');
      console.error(err);
    }

    console.log(
      '\n\n✨  Done ' +
        (totalProcessed || 0) +
        '/' +
        (total || 0) +
        ' documents.',
    );

    // Disconnect
    if (dbConnection) {
      console.log('Closing db...');
      dbConnection.close().then(
        function () {
          console.log('\nDisconnected from MongoDB');
          process.exit(0);
        },
        function (err) {
          console.log('\nFailed to disconnect DB:');
          console.error(err);
          process.exit(0);
        },
      );
    } else {
      console.log('DB already closed.');
      process.exit(0);
    }
  },
);
