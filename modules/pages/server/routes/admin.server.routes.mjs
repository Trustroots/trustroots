import volunteers from '../controllers/pages.volunteers.server.controller.js';

/**
 * Module dependencies.
 */

const registerRoutes = app => {
  app.route('/api/volunteers').get(volunteers.list);
};

export { registerRoutes };
export default registerRoutes;
