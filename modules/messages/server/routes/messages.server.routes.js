/**
 * Module dependencies.
 */
const messagesPolicy = require('../policies/messages.server.policy');
const messages = require('../controllers/messages.server.controller');

module.exports = function (app) {
  app
    .route('/api/messages')
    .all(messagesPolicy.isAllowed)
    .get(messages.inbox)
    .post(messages.send);

  app
    .route('/api/messages/:messageUserId')
    .all(messagesPolicy.isAllowed)
    .get(messages.thread);

  app
    .route('/api/messages-read')
    .all(messagesPolicy.isAllowed)
    .post(messages.markRead);

  app
    .route('/api/messages-count')
    .all(messagesPolicy.isAllowed)
    .get(messages.messagesCount);

  app
    .route('/api/messages-sync')
    .all(messagesPolicy.isAllowed)
    .get(messages.sync);

  // Finish by binding the message middleware
  app.param('messageUserId', messages.threadByUser);
};
