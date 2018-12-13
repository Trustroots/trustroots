'use strict';

/**
 * Module dependencies.
 */
var adminPolicy = require('../policies/admin.server.policy'),
    userProfile = require('../controllers/admin.profile.server.controller');

module.exports = function (app) {

  app.route('/api/admin/users').all(adminPolicy.isAllowed)
    .get(userProfile.adminSearch);
};
