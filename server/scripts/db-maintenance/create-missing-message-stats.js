#!/usr/bin/env node

/**
 * The purpose of this script is to fill the MessageStats collection with
 * statistics of the messages which were created before the introduction of the
 * MessageStat model to the application.
 * It will iterate through all the messages which are less than 90 days old and
 * create/update the corresponding MessageStat document.
 * If you want to iterate through a different time period, edit the
 * searchMessagesParam variable.
 */

// a day in milliseconds
const DAY = 24 * 3600 * 1000;

// we use searcMessagesParam as a parameter to find the messages whose
// MessageStat we'll create/update
//
// now we'll iterate only through the messages less than 90 days old
//
// in fact we'll update some threads older than 90 days (the ones which start
// earlier, but contain messages younger than 90 days), but we don't care. It
// doesn't influence the statistics thanks to the
// messageStatService.updateMessageStat's idempotence
var searchMessagesParam = {
  //* remove one '/' if you want to iterate through the messages of all the
  //  time
  created: {
    $gt: new Date(Date.now() - 90 * DAY)
  }
  // */
};

var path = require('path'),
    chalk = require('chalk'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    messageModels = require(path.resolve(
      './modules/messages/server/models/message.server.model')),
    messageStatModels = require(path.resolve(
      './modules/messages/server/models/message-stat.server.model')),
    Message = mongoose.model('Message'),
    messageStatService = require(path.resolve(
      './modules/messages/server/services/message-stat.server.service'));

    // the expression below uses ES6 Promises, so it shouldn't belong here.
    // there is a warning when one doesn't provide one's own library.
    // it was present elsewhere i believe
    mongoose.Promise = Promise;

// Bootstrap db connection
var db = mongoose.connect(config.db.uri, function(err) {
  if (err) {
    console.log(chalk.red('Could not connect to MongoDB!'));
    console.error(err);
  }
});

async.waterfall([

  // count all messages to be able to show progress
  function countAllMessages(done) {
    Message.count(searchMessagesParam).exec(function (err, messageNo) {
      done(err, messageNo);
    })
  },

  function findAndProcessMessages(messageNo, done) {
    console.log('found ' + messageNo + ' messages\n');
    console.log('streaming, and updating message stats for each message\n');

    // cursor for streaming from mongoDB
    var cursor = Message.find(searchMessagesParam)
      // .sort({ created: 1 })
      .cursor();

    // preparation for async.doWhilst function
    //
    // settings how often the progress will be printed to console
    // every PROGRESS_INTERVAL %
    const PROGRESS_INTERVAL = 0.1; // percent
    var keepGoing = true;
    var progress = 0; // progress counter

    // this is the test for async.doWhilst
    function testKeepGoing() {
      return keepGoing;
    }

    // here we process the message and (sometimes) print progress
    function saveMessageAndRunCounter(message, callback) {
      // updating the message stat
      messageStatService.updateMessageStat(message, function (err, resp) {
        if (err) return callback(err);
        // showing a progress
        if (progress % Math.ceil(messageNo / 100 * PROGRESS_INTERVAL) === 0) {
          // update the progress instead of logging to newline
          var progressPercent = (progress / messageNo * 100).toFixed(1);
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(progressPercent + '% (' + progress + '/' +
            messageNo + ')' + ' - ' + message.created + ' - ' + resp);
        }
        ++progress;

        return callback();
      });
    }

    // the iteratee (function to run in each step) of async.doWhilst
    function processNext(callback) {

      // getting the next message from mongodb
      cursor.next(function (err, msg) {
        // error
        if(err) {
          console.error(err);
          return callback(err);
        }

        // when we got to the end of stream
        // msg should be null at the end, but weaker check is safe
        if(!msg) {
          keepGoing = false;
          return callback();
        }

        // when there is a message to process, process it
        saveMessageAndRunCounter(msg, callback);
      });
    }

    // callback for the end of the script
    function finish(err) {
      return done(err, progress, messageNo);
    }

    async.doWhilst(processNext, testKeepGoing, finish);
  }
], function (err, processedNo, allNo) {
  mongoose.disconnect();
  if(err) {
    console.error(err);
    console.log('******************* errored **************************');
    return;
  }

  // finish writing the progress bar
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(Math.floor(processedNo / allNo * 100) + '% (' + processedNo + '/' + allNo + ') (ended)\n\n');

  console.log('************** finished successfully *****************');
  console.log('******* the message stats are up to date now *********');
  console.log('********************* bye! ***************************');

  return; // all finished!
});
