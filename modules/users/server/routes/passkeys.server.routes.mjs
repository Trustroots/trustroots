import controller from '../controllers/users.passkeys.server.controller.mjs';
import usersPolicy from '../policies/users.server.policy.mts';
import limits from '../../../core/server/middleware/targeted-request-limit.server.middleware.mjs';

export default function routes(app) {
  app
    .route('/api/users/passkeys')
    .all(usersPolicy.isAllowed)
    .get(controller.list);
  app
    .route('/api/users/passkeys/register/options')
    .all(usersPolicy.isAllowed)
    .post(limits.mfaManage, controller.registrationOptions);
  app
    .route('/api/users/passkeys/register/verify')
    .all(usersPolicy.isAllowed)
    .post(limits.mfaManage, controller.register);
  app
    .route('/api/users/passkeys/:id')
    .all(usersPolicy.isAllowed)
    .delete(limits.mfaManage, controller.remove);
  app
    .route('/api/auth/passkeys/options')
    .post(limits.mfaVerify, controller.authenticationOptions);
  app
    .route('/api/auth/passkeys/verify')
    .post(limits.mfaVerify, controller.authenticate);
}
