import adminAcquisitionStories from './../controllers/admin.acquisition-stories.server.controller.mjs';
import adminAuditLog from './../controllers/admin.audit-log.server.controller.mjs';
import adminMessages from './../controllers/admin.messages.server.controller.mjs';
import adminNewsletter from './../controllers/admin.newsletter.server.controller.mjs';
import adminPolicy from './../policies/admin.server.policy.mjs';
import adminThreads from './../controllers/admin.threads.server.controller.mjs';
import adminUsers from './../controllers/admin.users.server.controller.mjs';
import adminDashboard from './../controllers/admin.dashboard.server.controller.mjs';
import adminNotes from './../controllers/admin.notes.server.controller.mjs';
import adminReferenceThreads from './../controllers/admin.reference-threads.server.controller.mjs';

/**
 * Module dependencies.
 */

const privileged = [adminPolicy.isAllowed, adminPolicy.requireAdminElevation];

const registerRoutes = app => {
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
    .route('/api/admin/acquisition-stories/analysis')
    .all(...privileged)
    .post(adminAuditLog.record, adminAcquisitionStories.getAnalysis);
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
