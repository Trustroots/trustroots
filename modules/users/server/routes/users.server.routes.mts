import type { Response } from 'express';
import usersPolicy from './../policies/users.server.policy.mts';
import userProfile from './../controllers/users.profile.server.controller.mjs';
import userAvatar from './../controllers/users.avatar.server.controller.mjs';
import userPassword from './../controllers/users.password.server.controller.mjs';
import userAuthentication from './../controllers/users.authentication.server.controller.mjs';
import userExport from './../controllers/users.export.server.controller.mjs';
import unifiedPush from './../controllers/users.unified-push.server.controller.mjs';
import targetedRequestLimit from '../../../core/server/middleware/targeted-request-limit.server.middleware.mjs';
import userMfa from './../controllers/users.mfa.server.controller.mjs';
import userActivity from './../controllers/users.activity.server.controller.mjs';

function setActivityResponseHeaders(
  _req: unknown,
  res: Pick<Response, 'set' | 'vary'>,
  next: () => void,
) {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  return next();
}

/**
 * Module dependencies.
 */

type RouteHandler = (...arguments_: never[]) => unknown;
interface RouteChain {
  all(...handlers: RouteHandler[]): RouteChain;
  get(...handlers: RouteHandler[]): RouteChain;
  post(...handlers: RouteHandler[]): RouteChain;
  put(...handlers: RouteHandler[]): RouteChain;
  delete(...handlers: RouteHandler[]): RouteChain;
}
interface RouteApplication {
  route(path: string): RouteChain;
  param(name: string, handler: RouteHandler): void;
}

const defaultExport = function (app: RouteApplication) {
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
    .route('/api/users/activity')
    .all(setActivityResponseHeaders, usersPolicy.isAllowed)
    .get(userActivity.list);
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
  app.route('/api/users/mfa').all(usersPolicy.isAllowed).get(userMfa.settings);
  app
    .route('/api/users/mfa/enrol')
    .all(usersPolicy.isAllowed, targetedRequestLimit.mfaManage)
    .post(userMfa.beginEnrollment);
  app
    .route('/api/users/mfa/enrol/verify')
    .all(usersPolicy.isAllowed, targetedRequestLimit.mfaManage)
    .post(userMfa.verifyEnrollment);
  app
    .route('/api/users/mfa/recovery-codes')
    .all(usersPolicy.isAllowed, targetedRequestLimit.mfaManage)
    .post(userMfa.regenerateRecoveryCodes);
  app
    .route('/api/users/mfa/disable')
    .all(usersPolicy.isAllowed, targetedRequestLimit.mfaManage)
    .post(userMfa.disable);
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
export { defaultExport as 'module.exports' };
