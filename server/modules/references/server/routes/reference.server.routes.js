const path = require('path');
const config = require(path.resolve('./config/config'));
const referencePolicy = require('../policies/references.server.policy');
const references = require('../controllers/reference.server.controller');

module.exports = function (app) {
  if (config.featureFlags.reference) {
    app.route('/api/references').all(referencePolicy.isAllowed)
      .post(references.create)
      .get(references.readMany);

    app.route('/api/references/:referenceId').all(referencePolicy.isAllowed)
      .get(references.readOne);

    app.param('referenceId', references.referenceById);
  }
};
