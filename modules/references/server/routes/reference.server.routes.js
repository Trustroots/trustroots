const path = require('path');
const config = require(path.resolve('./config/config'));
const referencePolicy = require('../policies/references.server.policy');
const references = require('../controllers/reference.server.controller');

module.exports = function (app) {
  if (config.featureFlags.reference) {
    app
      .route('/api/experiences')
      .all(referencePolicy.isAllowed)
      .post(references.create)
      .get(references.readMany);

    app
      .route('/api/experiences/count')
      .all(referencePolicy.isAllowed)
      .get(references.getCount);

    app
      .route('/api/my-experience')
      .all(referencePolicy.isAllowed)
      .get(references.readMine);

    app
      .route('/api/experiences/:experienceId')
      .all(referencePolicy.isAllowed)
      .get(references.readOne);

    app.param('experienceId', references.referenceById);
  }
};
