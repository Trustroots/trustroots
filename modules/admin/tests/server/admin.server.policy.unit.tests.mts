import policy from '../../server/policies/admin.server.policy.mts';
import { assertGrants } from '../../../../testutils/server/route-grants.server.testutil.mts';

const support = [
  'GET /api/admin/dashboard',
  'POST /api/admin/network-connections',
  'GET /api/admin/network-connections/:memberId',
  'GET /api/admin/experiences',
  'POST /api/admin/experiences/:id/change-links',
  'GET /api/admin/experience-change-requests',
  'POST /api/admin/experience-change-requests/:id/decision',
  'GET /api/admin/support',
  'GET /api/admin/support/:requestId',
  'PATCH /api/admin/support/:requestId',
  'GET /api/admin/support/:requestId/conversation',
  'POST /api/admin/support/:requestId/replies',
  'POST /api/admin/support/:requestId/replies/:messageId/retry',
  'GET /api/admin/support/:requestId/:kind',
  'GET /api/admin/support-message-reviews/:reviewId',
  'GET /api/admin/support-members',
  'GET /api/admin/support-flagged-members',
  'PATCH /api/admin/support-members/:memberId/flag',
  'GET /api/admin/support-members/:memberId',
  'POST /api/admin/user/change-role',
  'GET /api/admin/notes',
  'POST /api/admin/notes',
];
const greeters = [
  'POST /api/admin/acquisition-stories',
  'POST /api/admin/acquisition-stories/:memberId/resend-confirmation',
  'GET /api/admin/location-corrections',
  'POST /api/admin/location-corrections/send',
  'GET /api/admin/staff-blockers',
];
const adminOnly = [
  'GET /api/admin/signup-review-rules',
  'PUT /api/admin/signup-review-rules',
  'POST /api/admin/support-import/preview',
  'POST /api/admin/support-import/apply',
  'GET /api/admin/circles',
  'POST /api/admin/circles',
  'POST /api/admin/nostr/featured-notes',
  'POST /api/admin/nostr/service-profile',
  'PUT /api/admin/nostr/featured-notes/:id',
  'DELETE /api/admin/nostr/featured-notes/:id',
  'POST /api/admin/nostr/featured-notes/:id/deletion',
  'GET /api/admin/circles/:circle',
  'PUT /api/admin/circles/:circle',
  'GET /api/admin/hackerspaces/preview',
  'GET /api/admin/hackerspaces/signer',
  'GET /api/admin/audit-log',
  'GET /api/admin/audit-log/actors',
  'GET /api/admin/username-changes',
  'GET /api/admin/gravatar',
  'GET /api/admin/gravatar/photo-check',
  'POST /api/admin/gravatar/photo-check',
  'POST /api/admin/messages',
  'POST /api/admin/messages/scammer-recipients',
  'POST /api/admin/messages/scammer-warning',
  'POST /api/admin/threads',
  'POST /api/admin/user',
  'POST /api/admin/user/unsuspend',
  'POST /api/admin/user/delete',
  'POST /api/admin/users',
  'POST /api/admin/users/by-role',
  'POST /api/admin/users/by-last-ip-hash',
  'GET /api/admin/email-replies',
  'GET /api/admin/reference-threads',
  'GET /api/admin/sparkpost/recovery',
  'POST /api/admin/sparkpost/recovery',
  'GET /api/admin/sparkpost/:action',
  'GET /api/admin/mongo',
  'GET /api/admin/newsletter-subscribers',
  'GET /api/admin/newsletter-subscribers/circle',
  'POST /api/admin/newsletter-subscribers/audience',
  'POST /api/admin/newsletter-subscribers/split',
];

const forRoles = (roles: string[], routes: string[]) =>
  roles.flatMap(role => routes.map(route => `${role} ${route}`));

describe('Admin policy unit tests', () => {
  it('lets each staff role reach exactly its admin routes', () => {
    assertGrants(policy.isAllowed, [
      ...forRoles(['admin', 'support-team'], support),
      ...forRoles(['admin', 'support-team', 'welcome-team'], greeters),
      'welcome-team POST /api/admin/acquisition-stories/:memberId/flag',
      ...forRoles(['admin'], adminOnly),
    ]);
  });
});
