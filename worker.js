'use strict';

/**
 * Trustroots
 *
 * Worker main entry file
 */
var async = require('async'),
    mongoose = require('./config/lib/mongoose'),
    worker = require('./config/lib/worker');

async.waterfall([

  // Bootstrap db connection
  function(done) {
    mongoose.connect(function() {
      done();
    });
  },

  // Load models
  function(done) {
    mongoose.loadModels(done);
  },

  // Clean out database
  function(done) {
    // Attempt to unlock jobs that were stuck due server restart
    // See https://github.com/agenda/agenda/issues/410
    worker.unlockAgendaJobs(done);
  },

  function() {
    // Start the worker
    worker.start({
      maxAttempts: 10,
      retryDelaySeconds: 10
    });
  }

], function (err) {
  if (err) {
    console.log('[Worker] error on initializing worker:');
    console.error(err);
  }
});
