import createMemoryPolicy from '../../../core/server/services/memory-policy.server.service.js';
import errorService from '../../../core/server/services/error.server.service.js';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mjs';

const service = {};

/**
 * Module dependencies.
 */
const acl = createMemoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl);

/**
 * Invoke Users Permissions
 */
service.invokeRolesPolicies = function () {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/users',
          permissions: [],
        },
        {
          resources: '/api/users/:username',
          permissions: [],
        },
        {
          resources: '/api/users/avatar',
          permissions: [],
        },
        {
          resources: '/api/users/mini/:userId',
          permissions: [],
        },
        {
          resources: '/api/users/password',
          permissions: [],
        },
        {
          resources: '/api/users/memberships',
          permissions: [],
        },
        {
          resources: '/api/users/memberships/:tribeId',
          permissions: [],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/users',
          permissions: ['get', 'put', 'delete'],
        },
        {
          resources: '/api/users/export',
          permissions: ['get'],
        },
        {
          resources: '/api/users/remove/:token',
          permissions: ['delete'],
        },
        {
          resources: '/api/users/:username',
          permissions: ['get'],
        },
        {
          resources: '/api/users/:avatarUserId/avatar',
          permissions: ['get'],
        },
        {
          resources: '/api/users-avatar',
          permissions: ['post'],
        },
        {
          resources: '/api/users/mini/:userId',
          permissions: ['get'],
        },
        {
          resources: '/api/users/password',
          permissions: ['post'],
        },
        {
          resources: '/api/users/memberships',
          permissions: ['get'],
        },
        {
          resources: '/api/users/memberships/:tribeId',
          permissions: ['post', 'delete'],
        },
        {
          resources: '/api/users/push/registrations',
          permissions: ['post'],
        },
        {
          resources: '/api/users/push/registrations/:token',
          permissions: ['delete'],
        },
        {
          resources: '/api/blocked-users',
          permissions: ['get'],
        },
        {
          resources: '/api/blocked-users/:username',
          permissions: ['put', 'delete'],
        },
      ],
    },
  ]);
};

/**
 * Check If Users Policy Allows
 */
service.isAllowed = function (req, res, next) {
  // Non-public profiles are invisible
  if (
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
};

const defaultExport = service;
export default defaultExport;
export const invokeRolesPolicies = defaultExport.invokeRolesPolicies;
export const isAllowed = defaultExport.isAllowed;
export { acl as _acl };
