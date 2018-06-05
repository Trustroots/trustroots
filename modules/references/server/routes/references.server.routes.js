'use strict';

/**
 * Module dependencies.
 */
var referencesPolicy = require('../policies/references.server.policy'),
    references = require('../controllers/references.server.controller');

module.exports = function (app) {
  app.route('/api/references/:referencesUserToId').all(referencesPolicy.isAllowed)
    .get(references.readReferences)
    .post(references.saveReference);

  // Finish by binding the middleware
  app.param('referencesUserToId', references.getReferencesByUserId);
};
