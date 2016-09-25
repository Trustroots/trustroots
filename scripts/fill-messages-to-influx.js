'use strict';
var path = require('path'),
    chalk = require('chalk'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    fluxIn = require(path.resolve('./modules/messages/server/services/message-to-influx.server.service')),
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

async.waterfall([

  function readAllMessages(done) {
    Message.find(done);
  },

  function processTheMessages(messages, done) {
    console.log('found ' + messages.length + ' messages\n');
    console.log('processing and adding the messages to influx now\n');

    // settings how often the progress will be printed to console
    // every PROGRESS_INTERVAL %
    const PROGRESS_INTERVAL = 1;
    var msgLen = messages.length;
    var progress = 0;  // a progress counter

    async.eachSeries(messages, saveMessageAndRunCounter, done);

    function saveMessageAndRunCounter(message, callback) {
      // showing a progress
      if (progress % Math.ceil(msgLen / 100 * PROGRESS_INTERVAL) === 0) {
        console.log(Math.floor(progress / msgLen * 100) + '%');
      }
      ++progress;

      // processing and saving the point to database
      fluxIn.save(message, callback);
    }

  }
], function (err) {
  mongoose.disconnect();
  if (err) {
    console.log(err);
    console.log('******************* errored **************************');
    return;
  }
  console.log('************** finished successfully *****************');
  console.log('******* you can play with the data in grafana ********');
  console.log('******************* or not ^_^ ***********************');
  console.log('********************* bye! ***************************');
});
