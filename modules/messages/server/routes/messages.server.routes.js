'use strict';

/**
 * Module dependencies.
 */
var messagesPolicy = require('../policies/messages.server.policy'),
    messages = require('../controllers/messages.server.controller');

module.exports = function(app) {

  app.route('/api/messages').all(messagesPolicy.isAllowed)
    .get(messages.inbox)
    .post(messages.send);

  app.route('/api/messages/:userId').all(messagesPolicy.isAllowed)
    .get(messages.thread);

  app.route('/api/messages-read').all(messagesPolicy.isAllowed)
    .post(messages.markRead);

  // Finish by binding the message middleware
  app.param('userId', messages.threadByUser);
};
