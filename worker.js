/**
 * Trustroots
 *
 * Worker main entry file
 */
var async = require('async'),
    mongooseService = require('./config/lib/mongoose'),
    worker = require('./config/lib/worker'),
    path = require('path'),
    log = require(path.resolve('./config/lib/logger'));

async.waterfall([

  // Bootstrap db connection
  function (done) {
    mongooseService.connect(function () {
      done();
    });
  },

  // Load models
  function (done) {
    mongooseService.loadModels(done);
  },

  // Clean out database
  function (done) {
    // Attempt to unlock jobs that were stuck due server restart
    // See https://github.com/agenda/agenda/issues/410
    worker.unlockAgendaJobs(done);
  },

  function () {
    // Start the worker
    worker.start({
      maxAttempts: 10,
      retryDelaySeconds: 10
    });
  }

], function (err) {
  if (err) {
    log('error', '[Worker] Error while initializing the background job worker.', err);
  }
});
