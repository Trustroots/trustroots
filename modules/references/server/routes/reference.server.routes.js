'use strict';

var path = require('path'),
    config = require(path.resolve('./config/config')),
    referencePolicy = require('../policies/references.server.policy'),
    references = require('../controllers/reference.server.controller');

module.exports = function (app) {
  if (config.featureFlags.reference) {
    app.route('/api/references').all(referencePolicy.isAllowed)
      .post(references.create)
      .get(references.readMany);

    app.route('/api/references/:referenceId')
      .get(references.readOne);

    app.param('referenceId', references.referenceById);
  }
};
