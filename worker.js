'use strict';
/**
 * Trustroots
 *
 * Worker main entry file
 */
var worker = require('./config/lib/worker'),
    mongoose = require('./config/lib/mongoose');

mongoose.connect(function() {
  mongoose.loadModels();
  worker.start({
    maxAttempts: 10,
    retryDelaySeconds: 10
  });
});
