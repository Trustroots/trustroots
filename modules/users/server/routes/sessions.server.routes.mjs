import {
  requireMember,
  list,
  confirmPassword,
  revoke,
  revokeAll,
} from '../controllers/users.sessions.server.controller.mjs';
import limits from '../../../core/server/middleware/targeted-request-limit.server.middleware.mjs';

export default function routes(app) {
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
