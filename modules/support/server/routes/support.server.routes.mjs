import support from './../controllers/support.server.controller.mjs';

/**
 * Module dependencies.
 */

const registerRoutes = function (app) {
  app.route('/api/support').post(support.supportRequest);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
