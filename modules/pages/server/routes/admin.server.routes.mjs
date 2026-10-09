import volunteers from './../controllers/pages.volunteers.server.controller.mjs';
import greeters from './../controllers/pages.greeters.server.controller.mjs';

/**
 * Module dependencies.
 */

const registerRoutes = app => {
  app.route('/api/volunteers').get(volunteers.list);
  app.route('/api/greeters').get(greeters.list);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
