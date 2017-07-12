'use strict';

/**
 * Module dependencies.
 */
var usersPolicy = require('../policies/users.server.policy'),
    users = require('../controllers/users.server.controller');

module.exports = function(app) {

  // Setting up the users profile api
  app.route('/api/users').all(usersPolicy.isAllowed)
    .delete(users.initializeRemoveProfile)
    .put(users.update);

  // Confirm user removal
  app.route('/api/users/remove/:token').all(usersPolicy.isAllowed)
    .delete(users.removeProfile);

  app.route('/api/users-avatar').all(usersPolicy.isAllowed)
    .post(users.avatarUploadField, users.avatarUpload);

  app.route('/api/users/memberships/:type?').all(usersPolicy.isAllowed)
    .get(users.getUserMemberships)
    .post(users.modifyUserTag);

  app.route('/api/users/invitecode').all(usersPolicy.isAllowed)
    .get(users.getInviteCode);

  app.route('/api/users/invitecode/:invitecode').all(usersPolicy.isAllowed)
    .post(users.validateInviteCode);

  app.route('/api/users/push/registrations').all(usersPolicy.isAllowed)
    .post(users.addPushRegistration);

  app.route('/api/users/push/registrations/:token').all(usersPolicy.isAllowed)
    .delete(users.removePushRegistration);

  app.route('/api/users/mini/:userId').all(usersPolicy.isAllowed)
    .get(users.getMiniUser);

  app.route('/api/users/accounts/:provider').delete(users.removeOAuthProvider);

  app.route('/api/users/password').post(users.changePassword);

  app.route('/api/users/:username').all(usersPolicy.isAllowed)
    .get(users.getUser);

  // Finish by binding the user middleware
  app.param('userId', users.userMiniByID);
  app.param('username', users.userByUsername);
};
