/**
 * Module dependencies.
 */
const support = require('../controllers/support.server.controller');

module.exports = function (app) {
  app.route('/api/support').post(support.supportRequest);
};
