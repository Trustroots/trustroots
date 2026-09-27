const config = require('../../../../config/config');
const experiencesPolicy = require('../policies/experiences.server.policy');
const experiences = require('../controllers/experiences.server.controller');
const changes = require('../controllers/experience-changes.server.controller');

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
      .route('/api/experiences/suggestion')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.getSuggestion);

    app
      .route('/api/my-experience')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.readMine);

    app
      .route('/api/experiences/:experienceId')
      .all(experiencesPolicy.isAllowed)
      .get(experiences.readOne);

    app
      .route('/api/experiences/:id/change-access')
      .all(experiencesPolicy.isAllowedChange)
      .get(changes.readAccess);

    app
      .route('/api/experiences/:id/change-requests')
      .all(experiencesPolicy.isAllowedChange)
      .post(changes.submit);

    app
      .route('/api/experiences/:id/change-requests/mine')
      .all(experiencesPolicy.isAllowedChange)
      .get(changes.readMine);

    app.param('experienceId', experiences.experienceById);
  }
};
