import tribesPolicy from '../policies/tribes.server.policy.js';
import tribes from '../controllers/tribes.server.controller.js';

/**
 * Module dependencies.
 */
function register(app) {
  app.route('/api/tribes').all(tribesPolicy.isAllowed).get(tribes.listTribes);

  app
    .route('/api/tribes/:tribe')
    .all(tribesPolicy.isAllowed)
    .get(tribes.getTribe);

  // Finish by binding the tribes middleware
  app.param('tribe', tribes.tribeBySlug);
}

export { register };
export default register;
