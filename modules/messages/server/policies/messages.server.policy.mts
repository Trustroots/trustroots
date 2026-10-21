import errorService from './../../../core/server/services/error.server.service.mts';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';

const authoriseRoute = createRouteAuthorisation({
  '/api/messages-hosting': { user: ['get'] },
  '/api/messages': { user: ['get', 'post'] },
  '/api/messages/:messageUserId': { user: ['get'] },
  '/api/messages-preview': { admin: ['post'], user: ['post'] },
  '/api/messages-read': { user: ['post'] },
  '/api/messages-count': { user: ['get'] },
  '/api/messages-sync': { user: ['get'] },
});

function isAllowed(req: PolicyRequest, res: PolicyResponse, next: PolicyNext) {
  // No messages feature for un-published users
  if (req.user && req.user.public !== true) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  return authoriseRoute(req, res, next);
}
export { isAllowed };
export default { isAllowed };
