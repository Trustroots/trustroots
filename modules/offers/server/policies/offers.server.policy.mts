import errorService from './../../../core/server/services/error.server.service.mts';
import { createRouteAuthorisation } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';
type OffersRequest = PolicyRequest & {
  offer?: { user: unknown };
};

const everything = ['get', 'post', 'put', 'delete'];
const authoriseRoute = createRouteAuthorisation({
  '/api/offers': { admin: everything, user: ['get', 'post'] },
  '/api/offers-by/:offerUserId': { admin: everything, user: ['get'] },
  '/api/offers/:offerId': { admin: everything, user: ['get', 'put', 'delete'] },
});

function isAllowed(req: OffersRequest, res: PolicyResponse, next: PolicyNext) {
  // No offers for non-authenticated nor for authenticated but un-published users
  if (!req.user || !req.user.public) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // If an offer is being processed and the current user owns it, then allow any manipulation
  if (req.offer && req.offer.user === req.user._id) {
    return next();
  }
  return authoriseRoute(req, res, next);
}
export { isAllowed };
export default { isAllowed };
