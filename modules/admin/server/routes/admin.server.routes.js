/**
 * Module dependencies.
 */
const adminPolicy = require('../policies/admin.server.policy');
const adminUsers = require('../controllers/admin.users.server.controller');

module.exports = (app) => {
  app.route('/api/admin/users').all(adminPolicy.isAllowed)
    .post(adminUsers.searchUsers);

  app.route('/api/admin/user').all(adminPolicy.isAllowed)
    .post(adminUsers.getUser);
};
