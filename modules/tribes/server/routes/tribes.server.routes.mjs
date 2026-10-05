import tribesPolicy from './../policies/tribes.server.policy.mjs';
import tribes from './../controllers/tribes.server.controller.mjs';

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
export { register as 'module.exports' };
