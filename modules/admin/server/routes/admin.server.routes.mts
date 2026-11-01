import {
  diagnostics,
  recover,
} from '../controllers/admin.sparkpost.server.controller.mts';
import * as spamCleanup from '../controllers/admin.spam-cleanup.server.controller.mts';
import adminCircles from '../controllers/admin.circles.server.controller.mjs';
import adminAcquisitionStories from './../controllers/admin.acquisition-stories.server.controller.mts';
import adminAuditLog from './../controllers/admin.audit-log.server.controller.mts';
import adminMessages from './../controllers/admin.messages.server.controller.mts';
import adminNewsletter from './../controllers/admin.newsletter.server.controller.mts';
import adminPolicy from './../policies/admin.server.policy.mts';
import adminThreads from './../controllers/admin.threads.server.controller.mts';
import adminUsernameChanges from './../controllers/admin.username-changes.server.controller.mts';
import adminUsers from './../controllers/admin.users.server.controller.mts';
import adminDashboard from './../controllers/admin.dashboard.server.controller.mts';
import support from '../controllers/admin.support.server.controller.mts';
import * as supportImport from '../controllers/admin.support-import.server.controller.mts';
import adminNotes from './../controllers/admin.notes.server.controller.mts';
import adminReferenceThreads from './../controllers/admin.reference-threads.server.controller.mts';
import adminHackerspaces from './../controllers/admin.hackerspaces.server.controller.mts';
import adminLocationCorrections from '../controllers/admin.location-corrections.server.controller.mts';
import adminExperienceChanges from '../controllers/admin.experience-changes.server.controller.mjs';

type RouteHandler = (...args: never[]) => unknown;

interface RouteChain {
  all(...handlers: RouteHandler[]): RouteChain;
  get(...handlers: RouteHandler[]): RouteChain;
  patch(...handlers: RouteHandler[]): RouteChain;
  post(...handlers: RouteHandler[]): RouteChain;
  put(...handlers: RouteHandler[]): RouteChain;
}

interface RouteApp {
  route(path: string): RouteChain;
}

/**
 * Module dependencies.
 */

const registerRoutes = (app: RouteApp): void => {
  app
    .route('/api/admin/sparkpost/recovery')
    .all(adminPolicy.isAllowed)
    .post(recover);
  app
    .route('/api/admin/sparkpost/:action')
    .all(adminPolicy.isAllowed)
    .get(diagnostics);
  app
    .route('/api/admin/spam-cleanup/preview')
    .all(adminPolicy.isAllowed)
    .post(spamCleanup.preview);
  app
    .route('/api/admin/spam-cleanup/apply')
    .all(adminPolicy.isAllowed)
    .post(spamCleanup.apply);
  app
    .route('/api/admin/support-import/preview')
    .all(adminPolicy.isAllowed)
    .post(supportImport.preview);
  app
    .route('/api/admin/support-import/apply')
    .all(adminPolicy.isAllowed)
    .post(supportImport.apply);
  app.route('/api/admin/support').all(adminPolicy.isAllowed).get(support.list);
  app
    .route('/api/admin/support/:requestId')
    .all(adminPolicy.isAllowed)
    .get(support.detail)
    .patch(support.setStatus);
  app
    .route('/api/admin/support/:requestId/conversation')
    .all(adminPolicy.isAllowed)
    .get(support.conversation);
  app
    .route('/api/admin/support/:requestId/replies')
    .all(adminPolicy.isAllowed)
    .post(support.reply);
  app
    .route('/api/admin/support/:requestId/replies/:messageId/retry')
    .all(adminPolicy.isAllowed)
    .post(support.retry);
  app
    .route('/api/admin/support/:requestId/:kind')
    .all(adminPolicy.isAllowed)
    .get(support.investigation);
  app
    .route('/api/admin/support-members')
    .all(adminPolicy.isAllowed)
    .get(support.searchMembers);
  app
    .route('/api/admin/support-members/:memberId')
    .all(adminPolicy.isAllowed)
    .get(support.member);
  app
    .route('/api/admin/hackerspaces/signer')
    .all(adminPolicy.isAllowed)
    .get(adminHackerspaces.signerIdentity);
  app
    .route('/api/admin/hackerspaces/preview')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminHackerspaces.preview);
  app
    .route('/api/admin/circles')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminCircles.list)
    .post(
      adminCircles.processImageUpload,
      adminAuditLog.record,
      adminCircles.create,
    );

  app
    .route('/api/admin/circles/:circle')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminCircles.get)
    .put(
      adminCircles.processImageUpload,
      adminAuditLog.record,
      adminCircles.update,
    );

  app
    .route('/api/admin/acquisition-stories')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminAcquisitionStories.list);
  app
    .route('/api/admin/location-corrections')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminLocationCorrections.list);

  app
    .route('/api/admin/location-corrections/send')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminLocationCorrections.send);

  app
    .route('/api/admin/audit-log')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.list);
  app
    .route('/api/admin/audit-log/actors')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.actors);
  app
    .route('/api/admin/username-changes')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminUsernameChanges.list);

  app
    .route('/api/admin/dashboard')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminDashboard.getDashboard);
  app
    .route('/api/admin/messages')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminMessages.getMessages);
  app
    .route('/api/admin/messages/scammer-recipients')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminMessages.getScammerRecipients);
  app
    .route('/api/admin/messages/scammer-warning')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminMessages.sendScammerWarning);
  app
    .route('/api/admin/threads')
    .all(adminPolicy.isAllowed)
    .post(
      adminAuditLog.record,
      adminUsers.usernameToUserId,
      adminThreads.getThreads,
    );
  app
    .route('/api/admin/notes')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminNotes.getNotes)
    .post(adminAuditLog.record, adminNotes.addNote);
  app
    .route('/api/admin/users')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.searchUsers);
  app
    .route('/api/admin/users/by-role')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.listUsersByRole);
  app
    .route('/api/admin/users/by-last-ip-hash')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.listUsersByLastIpHash);
  app
    .route('/api/admin/user')
    .all(adminPolicy.isAllowed)
    .post(
      adminAuditLog.record,
      adminUsers.usernameToUserId,
      adminUsers.getUser,
    );

  app
    .route('/api/admin/staff-blockers')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminUsers.listStaffBlockers);
  app
    .route('/api/admin/user/change-role')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.changeRole);
  app
    .route('/api/admin/reference-threads')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminReferenceThreads.list);
  app
    .route('/api/admin/experiences')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminExperienceChanges.findExperiences);

  app
    .route('/api/admin/experiences/:id/change-links')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminExperienceChanges.issueLink);

  app
    .route('/api/admin/experience-change-requests')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminExperienceChanges.listRequests);

  app
    .route('/api/admin/experience-change-requests/:id/decision')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminExperienceChanges.decide);

  app
    .route('/api/admin/newsletter-subscribers/split')
    .all(adminPolicy.isAllowed)
    .post(
      adminAuditLog.record,
      adminNewsletter.uploadSubscribersCsv,
      adminNewsletter.splitSubscribers,
    );
  app
    .route('/api/admin/newsletter-subscribers')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminNewsletter.list);
  app
    .route('/api/admin/newsletter-subscribers/audience')
    .all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminNewsletter.audience);
  app
    .route('/api/admin/newsletter-subscribers/circle')
    .all(adminPolicy.isAllowed)
    .get(adminAuditLog.record, adminNewsletter.listCircleMembers);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
