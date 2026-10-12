import config from './../../../../config/config.mjs';
import experiencesPolicy from './../policies/experiences.server.policy.mjs';
import experiences from './../controllers/experiences.server.controller.mjs';
function register(app) {
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
    app.param('experienceId', experiences.experienceById);
  }
}
export { register };
export default register;
export { register as 'module.exports' };
