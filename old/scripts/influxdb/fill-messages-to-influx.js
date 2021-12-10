var path = require('path'),
    chalk = require('chalk'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    messageToInflux = require(path.resolve('./modules/messages/server/services/message-to-influx.server.service')),
    messageModels = require(path.resolve('./modules/messages/server/models/message.server.model')),
    Message = mongoose.model('Message');

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

// Calculate data based only on messages after X Date
var messageQuery = {
  created: {
    $gt: new Date('2016-11-27')
  }
};
// Calculate data based on all messages
// var messageQuery = {};

async.waterfall([
  // count all messages to be able to show progress
  function countAllMessages(done) {
    Message.count(messageQuery).exec(function (err, messageNo) {
      done(err, messageNo);
    })
  },

  function findAndProcessMessages(messageNo, done) {
    console.log('found ' + messageNo + ' messages\n');
    console.log('streaming, processing and adding the messages to influx now\n');

    // cursor for streaming from mongoDB
    var cursor = Message.find(messageQuery).cursor();

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
      // showing a progress
      if (progress % Math.ceil(messageNo / 100 * PROGRESS_INTERVAL) === 0) {
        // update the progress instead of logging to newline
        var progressPercent = (progress / messageNo * 100).toFixed(1);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(progressPercent + '% (' + progress + '/' +
          messageNo + ')');
      }
      ++progress;

      // processing and saving the point to database
      messageToInflux.save(message, callback);
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
  console.log('******* you can play with the data in grafana ********');
  console.log('******************* or not ^_^ ***********************');
  console.log('********************* bye! ***************************');

  return; // all finished!
});
