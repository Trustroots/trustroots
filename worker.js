'use strict';

/**
 * Trustroots
 *
 * Worker main entry file
 */
var async = require('async'),
    debug = require('debug')('tr:worker:init'),
    mongooseService = require('./config/lib/mongoose'),
    worker = require('./config/lib/worker');

async.waterfall([

  // Bootstrap db connection
  function(done) {
    mongooseService.connect(function() {
      debug('[Worker] Connected to Mongoose service');
      done();
    },
    'Worker',
    // Options override: don't auto index on connect
    { autoIndex: false });
  },

  // Load models
  function(done) {
    mongooseService.loadModels(function(err) {
      if (err) {
        console.error('[Worker] Failed to load database models.');
      }
      done();
    }, 'Worker');
  },

  // Clean out database
  function(done) {
    // Attempt to unlock jobs that were stuck due server restart
    // See https://github.com/agenda/agenda/issues/410
    worker.unlockAgendaJobs(done);
  },

  function() {
    debug('[Worker] Start');
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
