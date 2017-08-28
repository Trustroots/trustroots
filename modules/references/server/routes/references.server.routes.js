'use strict';

/**
 * Module dependencies.
 */
var referencesPolicy = require('../policies/references.server.policy'),
    references = require('../controllers/references.server.controller');

module.exports = function (app) {

  app.route('/api/references/threads/:userToId').all(referencesPolicy.isAllowed)
    .get(references.readReferenceThread);

  app.route('/api/references/threads').all(referencesPolicy.isAllowed)
    .post(references.createReferenceThread);

  // Finish by binding the middleware
  app.param('userToId', references.readReferenceThreadById);
};
