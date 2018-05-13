'use strict';

/**
 * Module dependencies.
 */
var referenceUserPolicy = require('../policies/reference-user.server.policy'),
    referenceUser = require('../controllers/reference-user.server.controller');

module.exports = function (app) {

  app.route('/api/references/user/:userToId').all(referenceUserPolicy.isAllowed)
    .get(referenceUser.readReferenceUser);

  app.route('/api/references/user').all(referenceUserPolicy.isAllowed)
    .post(referenceUser.createReferenceUser);

  // Finish by binding the middleware
  app.param('userToId', referenceUser.readReferenceUserById);
};
