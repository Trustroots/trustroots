import errorService from './../../../core/server/services/error.server.service.mts';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type UsersRequest = PolicyRequest & {
  profile?: {
    public?: boolean;
    _id: { equals(id: unknown): boolean };
  };
};

const read = ['get'];
const authoriseRoute = createRouteAuthorisation({
  '/api/users': { user: ['get', 'put', 'delete'] },
  '/api/users/email-change': { user: ['post', 'delete'] },
  '/api/users/me/safety-visit': { user: ['put'] },
  '/api/users/export': { user: read },
  '/api/users/activity': { user: read },
  '/api/users/removal/pending': { user: ['get', 'delete'] },
  '/api/users/nostr/challenge': { user: ['post'] },
  '/api/users/remove/:token': { user: ['delete'] },
  '/api/users/:username': { admin: read, user: read, 'support-team': read },
  '/api/users/:avatarUserId/avatar': { admin: read, user: read },
  '/api/users-avatar': { user: ['post'] },
  '/api/users/mini/:userId': { user: read },
  '/api/users/password': { user: ['post'] },
  '/api/users/mfa': { user: read },
  '/api/users/mfa/enrol': { user: ['post'] },
  '/api/users/mfa/enrol/verify': { user: ['post'] },
  '/api/users/mfa/recovery-codes': { user: ['post'] },
  '/api/users/mfa/disable': { user: ['post'] },
  '/api/users/passkeys': { user: read },
  '/api/users/passkeys/register/options': { user: ['post'] },
  '/api/users/passkeys/register/verify': { user: ['post'] },
  '/api/users/passkeys/:id': { user: ['delete'] },
  '/api/users/accounts/:provider': { user: ['delete'] },
  '/api/users/memberships': { user: read },
  '/api/users/memberships/:tribeId': { user: ['post', 'delete'] },
  '/api/users/push/registrations': { user: ['post'] },
  '/api/users/push/registrations/:token': { user: ['delete'] },
  '/api/users/unified-push': { user: ['get', 'post', 'delete'] },
  '/api/users/unified-push/test': { user: ['post'] },
  '/api/blocked-users': { user: read },
  '/api/blocked-users/:username': { user: ['put', 'delete'] },
});

export function isSupportProfileRead(req: {
  user?: { roles?: string[] } | null;
  route?: { path: string };
  method?: string;
}): boolean {
  return (
    req.route?.path === '/api/users/:username' &&
    req.method === 'GET' &&
    req.user?.roles?.includes('support-team') === true
  );
}

/**
 * Check If Users Policy Allows
 */
function isAllowed(req: UsersRequest, res: PolicyResponse, next: PolicyNext) {
  const isStaffProfileRead =
    (req.user?.roles?.includes('admin') &&
      req.route.path === '/api/users/:username' &&
      req.method === 'GET') ||
    isSupportProfileRead(req);

  const isAdminAvatarRead =
    req.user?.roles?.includes('admin') &&
    req.route.path === '/api/users/:avatarUserId/avatar' &&
    req.method === 'GET';

  // Non-public profiles are invisible
  if (
    !isAdminAvatarRead &&
    !isStaffProfileRead &&
    req.profile &&
    !req.profile.public &&
    req.user &&
    !req.profile._id.equals(req.user._id)
  ) {
    return res.status(404).json({
      message: errorService.getErrorMessageByKey('not-found'),
    });
  }

  // No profile browsing for non-public users
  if (
    !isAdminAvatarRead &&
    !isStaffProfileRead &&
    req.profile &&
    req.user &&
    !req.user.public &&
    !req.profile._id.equals(req.user._id)
  ) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  return authoriseRoute(req, res, next);
}
export default { isAllowed };
export { isAllowed };
