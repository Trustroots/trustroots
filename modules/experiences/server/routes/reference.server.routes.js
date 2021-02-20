const path = require('path');
const config = require(path.resolve('./config/config'));
const experiencesPolicy = require('../policies/references.server.policy');
const experiences = require('../controllers/reference.server.controller');

module.exports = function (app) {
  if (config.featureFlags.reference) {
    app
      .route('/api/experiences')
      .all(experiencesPolicy.isAllowed)
      .post(experiences.create)
      .get(experiences.readMany);

    app
      .route('/api/experiences/count')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.getCount);

    app
      .route('/api/my-experience')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.readMine);

    app
      .route('/api/experiences/:experienceId')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.readOne);

    app.param('experienceId', experiences.experienceById);
  }
};
