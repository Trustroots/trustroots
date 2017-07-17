'use strict';

/**
 * Module dependencies.
 */
var usersPolicy = require('../policies/users.server.policy'),
    userProfile = require('../controllers/users.profile.server.controller'),
    userPassword = require('../controllers/users.password.server.controller'),
    userAuthentication = require('../controllers/users.authentication.server.controller');

module.exports = function (app) {

  // Setting up the users profile api
  app.route('/api/users').all(usersPolicy.isAllowed)
    .get(userProfile.search)
    .delete(userProfile.initializeRemoveProfile)
    .put(userProfile.update);

  // Confirm user removal
  app.route('/api/users/remove/:token').all(usersPolicy.isAllowed)
    .delete(userProfile.removeProfile);

  app.route('/api/users-avatar').all(usersPolicy.isAllowed)
    .post(userProfile.avatarUploadField, userProfile.avatarUpload);

  app.route('/api/users/memberships').all(usersPolicy.isAllowed)
    .get(userProfile.getUserMemberships);

  app.route('/api/users/memberships/:tribeId').all(usersPolicy.isAllowed)
    .post(userProfile.joinTribe)
    .delete(userProfile.leaveTribe);

  app.route('/api/users/invitecode').all(usersPolicy.isAllowed)
    .get(userProfile.getInviteCode);

  app.route('/api/users/invitecode/:invitecode').all(usersPolicy.isAllowed)
    .post(userProfile.validateInviteCode);

  app.route('/api/users/push/registrations').all(usersPolicy.isAllowed)
    .post(userProfile.addPushRegistration);

  app.route('/api/users/push/registrations/:token').all(usersPolicy.isAllowed)
    .delete(userProfile.removePushRegistration);

  app.route('/api/users/mini/:userId').all(usersPolicy.isAllowed)
    .get(userProfile.getMiniUser);

  app.route('/api/users/accounts/:provider').delete(userAuthentication.removeOAuthProvider);

  app.route('/api/users/password').post(userPassword.changePassword);

  app.route('/api/users/:username').all(usersPolicy.isAllowed)
    .get(userProfile.getUser);

  // Finish by binding the user middleware
  app.param('userId', userProfile.userMiniByID);
  app.param('username', userProfile.userByUsername);
};
