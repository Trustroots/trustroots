'use strict';
var path = require('path'),
    chalk = require('chalk'),
    co = require('co'),
    config = require(path.resolve('./config/config')),
    configMongoose = require(path.resolve('./config/lib/mongoose')),
    mongoose = require('mongoose'),
    fluxIn = require(path.resolve('./modules/messages/server/services/message-to-influx.server.service')),
    messageModels = require(path.resolve('./modules/messages/server/models/message.server.model')),
    Message = mongoose.model('Message');

mongoose.Promise = Promise;

// Bootstrap db connection
var db = mongoose.connect(config.db.uri, function(err) {
  if (err) {
    console.log(chalk.red('Could not connect to MongoDB!'));
    console.error(err);
  }
});

// settings how often the progress will be printed to console
// every PROGRESS_INTERVAL %
const PROGRESS_INTERVAL = 1;

co(function * () {
  let messages = yield Message.find();

  console.log(`found ${messages.length} messages\n`);
  console.log(`processing and adding the messages to influx now\n`);

  let msgLen = messages.length;
  let progress = 0;  // a progress counter
  for (let msg of messages) {
    yield fluxIn(msg);

    //showing a progress
    if(progress % Math.ceil(msgLen / 100 * PROGRESS_INTERVAL) === 0) {
      console.log(`${ Math.floor(progress / msgLen * 100) }%`);
    }
    ++progress;
  }

  console.log('************** finished successfully *****************');
  console.log('******* you can play with the data in grafana ********');
  console.log('******************* or not ^_^ ***********************');
  console.log('********************* bye! ***************************');

  mongoose.disconnect();
}).catch(function (e) {
  console.error(e);
  console.log('******************* errored **************************');
  mongoose.disconnect();
});
