/**
 * Module dependencies.
 */
const usersPolicy = require('../policies/users.server.policy');
const userProfile = require('../controllers/users.profile.server.controller');
const userAvatar = require('../controllers/users.avatar.server.controller');
const userPassword = require('../controllers/users.password.server.controller');
const userAuthentication = require('../controllers/users.authentication.server.controller');

module.exports = function (app) {
  // Setting up the users profile api
  app
    .route('/api/users')
    .all(usersPolicy.isAllowed)
    .get(userProfile.search)
    .delete(userProfile.initializeRemoveProfile)
    .put(userProfile.update);

  // Confirm user removal
  app
    .route('/api/users/remove/:token')
    .all(usersPolicy.isAllowed)
    .delete(userProfile.removeProfile);

  app
    .route('/api/users-avatar')
    .all(usersPolicy.isAllowed)
    .post(userAvatar.avatarUploadField, userAvatar.avatarUpload);

  app
    .route('/api/users/:avatarUserId/avatar')
    .all(usersPolicy.isAllowed)
    .get(userAvatar.getAvatar);

  app
    .route('/api/users/memberships')
    .all(usersPolicy.isAllowed)
    .get(userProfile.getUserMemberships);

  app
    .route('/api/users/memberships/:tribeId')
    .all(usersPolicy.isAllowed)
    .post(userProfile.joinTribe)
    .delete(userProfile.leaveTribe);

  app
    .route('/api/users/push/registrations')
    .all(usersPolicy.isAllowed)
    .post(userProfile.addPushRegistration);

  app
    .route('/api/users/push/registrations/:token')
    .all(usersPolicy.isAllowed)
    .delete(userProfile.removePushRegistration);

  app
    .route('/api/users/mini/:userId')
    .all(usersPolicy.isAllowed)
    .get(userProfile.getMiniUser);

  app
    .route('/api/users/accounts/:provider')
    .delete(userAuthentication.removeOAuthProvider);

  app.route('/api/users/password').post(userPassword.changePassword);

  app
    .route('/api/users/:username')
    .all(usersPolicy.isAllowed)
    .get(userProfile.getUser);

  // Finish by binding the user middleware
  app.param('userId', userProfile.userMiniByID);
  app.param('username', userProfile.userByUsername);
  app.param('avatarUserId', userAvatar.userForAvatarByUserId);
};
