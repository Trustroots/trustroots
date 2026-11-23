import errorService from './../../../core/server/services/error.server.service.mts';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type ReferenceThreadRequest = PolicyRequest & {
  referenceThread?: { userFrom: { equals(id: unknown): boolean } };
};

const authoriseRoute = createRouteAuthorisation({
  '/api/references-thread': { admin: ['post'], user: ['post'] },
  '/api/references-thread/:referenceThreadUserToId': {
    admin: ['get'],
    user: ['get'],
  },
});

function isAllowed(
  req: ReferenceThreadRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
  // No references for non-authenticated users
  // No reference writing for authenticated but un-published users, except if they're reading existing reference
  if (!req.user || (!req.user.public && req.method.toLowerCase() !== 'get')) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an referenceThread is being processed and the current user "owns" it, then allow any manipulation
  if (
    req.referenceThread &&
    req.referenceThread.userFrom.equals(req.user._id)
  ) {
    return next();
  }
  return authoriseRoute(req, res, next);
}
export { isAllowed };
export default { isAllowed };
