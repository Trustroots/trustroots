import support from './../controllers/support.server.controller.mjs';
import targetedRequestLimit from '../../../core/server/middleware/targeted-request-limit.server.middleware.mjs';

/**
 * Module dependencies.
 */

const registerRoutes = function (app) {
  app
    .route('/api/support')
    .post(targetedRequestLimit.support, support.supportRequest);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
