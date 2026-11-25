import {
  requireMember,
  list,
  confirmPassword,
  revoke,
  revokeAll,
} from '../controllers/users.sessions.server.controller.mts';
import limits from '../../../core/server/middleware/targeted-request-limit.server.middleware.mts';

type RouteHandler = (...args: never[]) => unknown;
interface RouteChain {
  all(...handlers: RouteHandler[]): RouteChain;
  get(...handlers: RouteHandler[]): RouteChain;
  delete(...handlers: RouteHandler[]): RouteChain;
}
interface RouteApp {
  route(path: string): RouteChain;
}

export default function routes(app: RouteApp) {
  app
    .route('/api/auth/sessions')
    .all(requireMember)
    .get(list)
    .delete(limits.manageSessions, confirmPassword, revokeAll);
  app
    .route('/api/auth/sessions/:id')
    .all(requireMember)
    .delete(limits.manageSessions, confirmPassword, revoke);
}
