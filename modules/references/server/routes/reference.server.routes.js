'use strict';

var referencePolicy = require('../policies/references.server.policy'),
    referenceThread = require('../controllers/reference.server.controller');

module.exports = function (app) {
  app.route('/api/references').all(referencePolicy.isAllowed)
    .post(referenceThread.create);
};
