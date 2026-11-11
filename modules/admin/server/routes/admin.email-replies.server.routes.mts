import type { Application } from 'express';
import { previewEmailReplies } from '../controllers/admin.email-replies.server.controller.mts';
import adminPolicy from '../policies/admin.server.policy.mts';

export default function registerEmailReplyRoutes(
  app: Pick<Application, 'route'>,
) {
  app
    .route('/api/admin/email-replies')
    .all(adminPolicy.isAllowed)
    .get(previewEmailReplies);
}
