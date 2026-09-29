import support from '../controllers/support.server.controller.js';

/**
 * Module dependencies.
 */

const registerRoutes = function (app) {
  app.route('/api/support').post(support.supportRequest);
};

export { registerRoutes };
export default registerRoutes;
