/**
 * Module dependencies.
 */
const volunteers = require('../controllers/pages.volunteers.server.controller');

module.exports = app => {
  app.route('/api/volunteers').get(volunteers.list);
};
