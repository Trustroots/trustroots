'use strict';

/**
 * Module dependencies.
 */
var passport = require('passport');

module.exports = function(app) {

  // User Routes
  var users = require('../controllers/users.server.controller');

  // Setting up the users profile api
  app.route('/api/users').put(users.requiresLogin, users.update);
  app.route('/api/users/:username').get(users.requiresLogin, users.getUser);
  app.route('/api/users/accounts').delete(users.removeOAuthProvider);
  app.route('/api/users/avatar').post(users.requiresLogin, users.upload);
  app.route('/api/users/mini/:userId').get(users.requiresLogin, users.getMiniUser);
  app.route('/api/users/password').post(users.requiresLogin, users.changePassword);

  // Finish by binding the user middleware
  app.param('userId', users.userMiniByID);
  app.param('username', users.userByUsername);
};
