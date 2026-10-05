import usersPolicy from '../policies/users.server.policy.js';
import userProfile from '../controllers/users.profile.server.controller.js';
import userAvatar from '../controllers/users.avatar.server.controller.js';
import userPassword from '../controllers/users.password.server.controller.js';
import userAuthentication from '../controllers/users.authentication.server.controller.js';
import userExport from '../controllers/users.export.server.controller.js';
import unifiedPush from '../controllers/users.unified-push.server.controller.js';
import targetedRequestLimit from '../../../core/server/middleware/targeted-request-limit.server.middleware.js';

/**
 * Module dependencies.
 */

const defaultExport = function (app) {
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
    .route('/api/users/export')
    .all(usersPolicy.isAllowed)
    .get(userExport.download);

  app
    .route('/api/users-avatar')
    .all(usersPolicy.isAllowed)
    .post(
      targetedRequestLimit.avatarUpload,
      userAvatar.avatarUploadField,
      userAvatar.avatarUpload,
    );

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
    .route('/api/users/unified-push')
    .all(usersPolicy.isAllowed)
    .get(unifiedPush.configuration)
    .post(unifiedPush.add)
    .delete(unifiedPush.remove);

  app
    .route('/api/users/mini/:userId')
    .all(usersPolicy.isAllowed)
    .get(userProfile.getMiniUser);

  app
    .route('/api/users/accounts/:provider')
    .all(usersPolicy.isAllowed)
    .delete(userAuthentication.removeOAuthProvider);

  app
    .route('/api/users/password')
    .all(usersPolicy.isAllowed)
    .post(userPassword.changePassword);

  app
    .route('/api/users/:username')
    .all(usersPolicy.isAllowed)
    .get(userProfile.getUser);

  // Finish by binding the user middleware
  app.param('userId', userProfile.userMiniByID);
  app.param('username', userProfile.userByUsername);
  app.param('avatarUserId', userAvatar.userForAvatarByUserId);
};
export default defaultExport;
