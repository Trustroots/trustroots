'use strict';

var mongooseService = require('../config/lib/mongoose');
var async = require('async');

async.waterfall([

  // Load models
  function (asyncDone) {
    mongooseService.loadModels(function () {
      // global.asyncDump();
      console.log('Models completed loading...');
      asyncDone(null);
    });
  },

  // Connect to the database
  function (asyncDone) {
    mongooseService.connect(function (db) {
      console.log('Database connected...');
      run();
      asyncDone(null, db);
    });
  },

  // Clean out test database to have clean base
  function (db, asyncDone) {
    mongooseService.dropDatabase(db, function () {
      console.log('Running the tests ...');
      run();
      asyncDone(null);
    });
  }

], function () {
  // Kick off running the tests using mocha
  // Note run() is only available when using mocha's --delay flag.
  run();
});

