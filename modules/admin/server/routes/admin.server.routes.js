/**
 * Module dependencies.
 */
const adminAcquisitionStories = require('../controllers/admin.acquisition-stories.server.controller');
const adminAuditLog = require('../controllers/admin.audit-log.server.controller');
const adminMessages = require('../controllers/admin.messages.server.controller');
const adminPolicy = require('../policies/admin.server.policy');
const adminUsers = require('../controllers/admin.users.server.controller');

module.exports = (app) => {
  app.route('/api/admin/acquisition-stories').all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminAcquisitionStories.list);

  app.route('/api/admin/audit-log').all(adminPolicy.isAllowed)
    .get(adminAuditLog.list);

  app.route('/api/admin/messages').all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminMessages.getMessages);

  app.route('/api/admin/users').all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.searchUsers);

  app.route('/api/admin/user').all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.getUser);

  app.route('/api/admin/user/suspend').all(adminPolicy.isAllowed)
    .post(adminAuditLog.record, adminUsers.suspend);
};
