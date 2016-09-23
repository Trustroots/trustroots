'use strict';
var mongoose = require('mongoose');
var co = require('co');
var path = require('path');
var influxService = require(path.resolve('./modules/core/server/services/influx.server.service'));
let fluxIn = require(path.resolve('./modules/messages/server/services/message-to-influx.server.service'));

mongoose.Promise = Promise;

require('./fill-messages-to-influx/message.server.model.js');
var Message = mongoose.model('Message');

// the database name needs to be changed if you run this in production
// TODO the main config should be used for this
mongoose.connect('mongodb://localhost/trustroots-dev');

// settings how often the progressbar will be printed to console
// every PROGRESS_INTERVAL %
const PROGRESS_INTERVAL = 1;

co(function * () {
  let messages = yield Message.find();

  console.log(`found ${messages.length} messages\n`);
  console.log(`processing and adding the messages to influx now\n`);

  let msgLen = messages.length;
  let progress = 0;  // a progress counter
  for (let msg of messages) {
    yield fluxIn(msg, { Message: Message, influxService: influxService });

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
