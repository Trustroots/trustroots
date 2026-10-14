import memoryPolicy from './../../../core/server/services/memory-policy.server.service.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type ContactsRequest = PolicyRequest & {
  contact?: {
    userFrom: { _id: { equals(id: unknown): boolean } };
    userTo: { _id: { equals(id: unknown): boolean } };
  };
};

/**
 * Module dependencies.
 */
const acl = memoryPolicy();
const authoriseRoute = createRouteAuthorisation(acl);
/**
 * Invoke Contacts Permissions
 */
function invokeRolesPolicies() {
  acl.allow([
    {
      roles: ['admin'],
      allows: [
        {
          resources: '/api/contact',
          permissions: [],
        },
        {
          resources: '/api/contact-by/:contactUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contact/:contactId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId/common',
          permissions: ['get'],
        },
      ],
    },
    {
      roles: ['user'],
      allows: [
        {
          resources: '/api/contact',
          permissions: ['post'],
        },
        {
          resources: '/api/contact-by/:contactUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contact/:contactId',
          permissions: ['get', 'put'],
        },
        {
          resources: '/api/contacts/:listUserId',
          permissions: ['get'],
        },
        {
          resources: '/api/contacts/:listUserId/common',
          permissions: ['get'],
        },
      ],
    },
  ]);
}

/**
 * Check If Contacts Policy Allows
 */
function isAllowed(
  req: ContactsRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
  // No contacts for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an contact is being processed and the current user is
  // other party of the connection, then allow any manipulation
  // 'Delete' gets allowed here
  if (
    req.contact &&
    req.user &&
    (req.contact.userFrom._id.equals(req.user._id.valueOf()) ||
      req.contact.userTo._id.equals(req.user._id.valueOf()))
  ) {
    return next();
  }
  return authoriseRoute(req, res, next);
}
const service = {
  invokeRolesPolicies,
  isAllowed,
};
export { invokeRolesPolicies, isAllowed };
export default service;

// Expose the ACL dependency for native ESM boundary stubs.
export { acl as _acl };
export { service as 'module.exports' };
