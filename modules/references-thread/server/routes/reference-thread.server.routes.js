'use strict';

/**
 * Module dependencies.
 */
var referenceThreadPolicy = require('../policies/reference-thread.server.policy'),
    referenceThread = require('../controllers/reference-thread.server.controller');

module.exports = function (app) {

  app.route('/api/references-thread/:referenceThreadUserToId').all(referenceThreadPolicy.isAllowed)
    .get(referenceThread.readReferenceThread);

  app.route('/api/references-thread').all(referenceThreadPolicy.isAllowed)
    .post(referenceThread.createReferenceThread);

  // Finish by binding the middleware
  app.param('referenceThreadUserToId', referenceThread.readReferenceThreadById);
};
