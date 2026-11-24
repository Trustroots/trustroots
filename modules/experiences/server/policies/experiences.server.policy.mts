import errorService from './../../../core/server/services/error.server.service.mts';
import { isRouteAllowed } from '../../../core/server/services/route-authorisation.server.service.mts';
import type {
  PolicyNext,
  PolicyRequest,
  PolicyResponse,
} from '../../../core/server/services/policy-types.server.mts';

const members = (...methods: string[]) => ({ user: methods, admin: methods });
const grants = {
  '/api/experiences': members('get', 'post'),
  '/api/experiences/count': members('get'),
  '/api/experiences/suggestion': members('get'),
  '/api/experiences/reply-recipient/:recipientUsername': members('get'),
  '/api/my-experience': members('get'),
  '/api/experiences/:experienceId': members('get'),
  '/api/experiences/:id/change-access': members('get'),
  '/api/experiences/:id/change-requests': members('post'),
  '/api/experiences/:id/change-requests/mine': members('get'),
};

function forbid(res: PolicyResponse) {
  return res.status(403).json({
    message: errorService.getErrorMessageByKey('forbidden'),
  });
}

/** Granted routes for published members only. */
function isAllowed(req: PolicyRequest, res: PolicyResponse, next: PolicyNext) {
  return req.user?.public && isRouteAllowed(grants, req) ? next() : forbid(res);
}

/** Granted routes for any signed-in member, published or not. */
function isAllowedChange(
  req: PolicyRequest,
  res: PolicyResponse,
  next: PolicyNext,
) {
  return req.user && isRouteAllowed(grants, req) ? next() : forbid(res);
}

export { isAllowed, isAllowedChange };
export default { isAllowed, isAllowedChange };
