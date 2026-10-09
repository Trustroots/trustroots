import referenceThreadPolicy from './../policies/reference-thread.server.policy.mjs';
import referenceThread from './../controllers/reference-thread.server.controller.mjs';

/**
 * Module dependencies.
 */
function register(app) {
  app
    .route('/api/references-thread/:referenceThreadUserToId')
    .all(referenceThreadPolicy.isAllowed)
    .get(referenceThread.readReferenceThread);
  app
    .route('/api/references-thread')
    .all(referenceThreadPolicy.isAllowed)
    .post(referenceThread.createReferenceThread);

  // Finish by binding the middleware
  app.param('referenceThreadUserToId', referenceThread.readReferenceThreadById);
}
export { register };
export default register;
export { register as 'module.exports' };
