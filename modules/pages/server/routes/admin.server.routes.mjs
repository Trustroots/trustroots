import volunteers from './../controllers/pages.volunteers.server.controller.mjs';

/**
 * Module dependencies.
 */

const registerRoutes = app => {
  app.route('/api/volunteers').get(volunteers.list);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
