'use strict';

/**
 * Module dependencies.
 */
module.exports = function(app) {

  var users = require('../../../users/server/controllers/users.server.controller');
  var messages = require('../controllers/messages.server.controller');

  // Message Routes
  app.route('/api/messages')
    .get(users.requiresLogin, messages.inbox)
    .post(users.requiresLogin, messages.send);

  app.route('/api/messages/:userId')
    .get(users.requiresLogin, messages.thread);
    //.put(users.requiresLogin, messages.hasAuthorization, messages.update)
    //.delete(users.requiresLogin, messages.hasAuthorization, messages.delete);

app.route('/api/messages-read')
  .post(users.requiresLogin, messages.markRead);


  // Finish by binding the message middleware
  app.param('userId', messages.threadByUser);
};
