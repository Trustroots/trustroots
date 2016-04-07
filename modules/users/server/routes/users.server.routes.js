'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    config = require(path.resolve('./config/config')),
    usersPolicy = require('../policies/users.server.policy'),
    users = require('../controllers/users.server.controller');

module.exports = function(app) {

  // Setting up the users profile api
  app.route('/api/users').all(usersPolicy.isAllowed)
    .put(users.update);

  app.route('/api/users-avatar').all(usersPolicy.isAllowed)
    .post(users.avatarUploadField, users.avatarUpload);

  app.route('/api/users/tags').all(usersPolicy.isAllowed)
    .post(users.modifyUserTag);

  app.route('/api/users/mini/:userId').all(usersPolicy.isAllowed)
    .get(users.getMiniUser);

  app.route('/api/users/accounts/:provider').delete(users.removeOAuthProvider);

  app.route('/api/users/password').post(users.changePassword);

  app.route('/api/users/:username').all(usersPolicy.isAllowed)
    .get(users.getUser);

  // Finish by binding the user middleware
  app.param('userId', users.userMiniByID);
  app.param('username', users.userByUsername);
};
