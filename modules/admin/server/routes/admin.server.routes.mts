import adminAcquisitionStories from './../controllers/admin.acquisition-stories.server.controller.mts';
import adminAuditLog from './../controllers/admin.audit-log.server.controller.mts';
import adminMessages from './../controllers/admin.messages.server.controller.mts';
import adminNewsletter from './../controllers/admin.newsletter.server.controller.mts';
import adminPolicy from './../policies/admin.server.policy.mts';
import adminThreads from './../controllers/admin.threads.server.controller.mts';
import adminUsers from './../controllers/admin.users.server.controller.mts';
import adminDashboard from './../controllers/admin.dashboard.server.controller.mts';
import support from '../controllers/admin.support.server.controller.mts';
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
}

interface RouteApp {
  route(path: string): RouteChain;
}

/**
 * Module dependencies.
 */

const privileged = [adminPolicy.isAllowed, adminPolicy.requireAdminElevation];

const registerRoutes = (app: RouteApp): void => {
  app.route('/api/admin/support').all(adminPolicy.isAllowed).get(support.list);
  app
    .route('/api/admin/support/:requestId')
    .all(adminPolicy.isAllowed)
    .get(support.detail)
    .patch(support.setStatus);
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
    .route('/api/admin/hackerspaces/preview')
    .all(...privileged)
    .get(adminAuditLog.record, adminHackerspaces.preview);
  // Password step-up unlocks other admin routes for a short elevation window.
  app
    .route('/api/admin/elevate')
    .all(adminPolicy.isAllowed)
    .post(adminPolicy.confirmAdminPassword, adminPolicy.elevateAdminSession);

  app
    .route('/api/admin/acquisition-stories')
    .all(...privileged)
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
    .all(...privileged)
    .get(adminAuditLog.list);
  app
    .route('/api/admin/audit-log/actors')
    .all(...privileged)
    .get(adminAuditLog.actors);

  app
    .route('/api/admin/dashboard')
    .all(...privileged)
    .get(adminAuditLog.record, adminDashboard.getDashboard);
  app
    .route('/api/admin/messages')
    .all(...privileged)
    .post(adminAuditLog.record, adminMessages.getMessages);
  app
    .route('/api/admin/messages/scammer-recipients')
    .all(...privileged)
    .post(adminAuditLog.record, adminMessages.getScammerRecipients);
  app
    .route('/api/admin/messages/scammer-warning')
    .all(...privileged)
    .post(adminAuditLog.record, adminMessages.sendScammerWarning);
  app
    .route('/api/admin/threads')
    .all(...privileged)
    .post(
      adminAuditLog.record,
      adminUsers.usernameToUserId,
      adminThreads.getThreads,
    );
  app
    .route('/api/admin/notes')
    .all(...privileged)
    .get(adminAuditLog.record, adminNotes.getNotes)
    .post(adminAuditLog.record, adminNotes.addNote);
  app
    .route('/api/admin/users')
    .all(...privileged)
    .post(adminAuditLog.record, adminUsers.searchUsers);
  app
    .route('/api/admin/users/by-role')
    .all(...privileged)
    .post(adminAuditLog.record, adminUsers.listUsersByRole);
  app
    .route('/api/admin/users/by-last-ip-address')
    .all(...privileged)
    .post(adminAuditLog.record, adminUsers.listUsersByLastIpAddress);
  app
    .route('/api/admin/user')
    .all(...privileged)
    .post(
      adminAuditLog.record,
      adminUsers.usernameToUserId,
      adminUsers.getUser,
    );

  app
    .route('/api/admin/staff-blockers')
    .all(...privileged)
    .get(adminAuditLog.record, adminUsers.listStaffBlockers);
  app
    .route('/api/admin/user/change-role')
    .all(...privileged)
    .post(adminAuditLog.record, adminUsers.changeRole);
  app
    .route('/api/admin/reference-threads')
    .all(...privileged)
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
    .all(...privileged)
    .post(
      adminAuditLog.record,
      adminNewsletter.uploadSubscribersCsv,
      adminNewsletter.splitSubscribers,
    );
  app
    .route('/api/admin/newsletter-subscribers')
    .all(...privileged)
    .get(adminAuditLog.record, adminNewsletter.list);
  app
    .route('/api/admin/newsletter-subscribers/audience')
    .all(...privileged)
    .post(adminAuditLog.record, adminNewsletter.audience);
  app
    .route('/api/admin/newsletter-subscribers/circle')
    .all(...privileged)
    .get(adminAuditLog.record, adminNewsletter.listCircleMembers);
};
export { registerRoutes };
export default registerRoutes;
export { registerRoutes as 'module.exports' };
