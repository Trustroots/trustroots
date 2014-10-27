'use strict';

/**
 * Module dependencies.
 */
var users = require('../../app/controllers/users'),
  messages = require('../../app/controllers/messages');

module.exports = function(app) {
  // Message Routes
  app.route('/messages')
    .get(users.requiresLogin, messages.inbox)
    .post(users.requiresLogin, messages.send);

  app.route('/messages/:userId')
    .get(users.requiresLogin, messages.thread);
    //.put(users.requiresLogin, messages.hasAuthorization, messages.update)
    //.delete(users.requiresLogin, messages.hasAuthorization, messages.delete);

  // Finish by binding the message middleware
  app.param('userId', messages.threadByUser);
};