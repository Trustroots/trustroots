'use strict';

/**
 * Module dependencies.
 */
var passport = require('passport');

module.exports = function(app) {
  // User Routes
  var users = require('../controllers/users.server.controller');

  // Confirm users email
  app.route('/api/auth/confirm-email/:token').get(users.validateEmailToken);
  app.route('/api/auth/confirm-email/:token').post(users.confirmEmail);

  // Setting up the users password api
  app.route('/api/auth/forgot').post(users.forgot);
  app.route('/api/auth/reset/:token').get(users.validateResetToken);
  app.route('/api/auth/reset/:token').post(users.reset);

  // Setting up the users authentication api
  app.route('/api/auth/signup').post(users.requiresAnonymous, users.signup);
  app.route('/api/auth/signin').post(users.requiresAnonymous, users.signin);
  app.route('/api/auth/signout').get(users.signout);

  // Setting the facebook oauth routes
  app.route('/api/auth/facebook').get(passport.authenticate('facebook', {
    scope: ['email']
  }));
  app.route('/api/auth/facebook/callback').get(users.oauthCallback('facebook'));

  // Setting the twitter oauth routes
  app.route('/api/auth/twitter').get(passport.authenticate('twitter'));
  app.route('/api/auth/twitter/callback').get(users.oauthCallback('twitter'));

  // Setting the github oauth routes
  app.route('/api/auth/github').get(passport.authenticate('github'));
  app.route('/api/auth/github/callback').get(users.oauthCallback('github'));

  // Finish by binding the user middleware
  app.param('userId', users.userMiniByID);
  app.param('username', users.userByUsername);
};
