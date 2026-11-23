import errorService from './../../../core/server/services/error.server.service.mts';
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

const read = ['get'];
const authoriseRoute = createRouteAuthorisation({
  '/api/contact': { user: ['post'] },
  '/api/contact-by/:contactUserId': { admin: read, user: read },
  '/api/contact/:contactId': { admin: read, user: ['get', 'put'] },
  '/api/contacts/:listUserId': { admin: read, user: read },
  '/api/contacts/:listUserId/common': { admin: read, user: read },
});

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
export { isAllowed };
export default { isAllowed };
