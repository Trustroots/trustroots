'use strict';

/**
 * Module dependencies.
 */
var usersPolicy = require('../policies/users.server.policy'),
    passport = require('passport');

module.exports = function(app) {
  // User Routes
  var users = require('../controllers/users.server.controller');

  // Confirm users email
  app.route('/api/auth/confirm-email/:token')
    .get(users.validateEmailToken)
    .post(users.confirmEmail);

  // Resend email confirmation
  app.route('/api/auth/resend-confirmation')
    .post(users.resendConfirmation);

  // Setting up the users password api
  app.route('/api/auth/forgot').post(users.forgot);
  app.route('/api/auth/reset/:token')
    .get(users.validateResetToken)
    .post(users.reset);

  // Setting up the users authentication api
  app.route('/api/auth/signup').post(users.signup);
  app.route('/api/auth/signin').post(users.signin);
  app.route('/api/auth/signout').get(users.signout);

  // Setting the facebook oauth routes
  app.route('/api/auth/facebook').all(usersPolicy.isAllowed)
    .get(passport.authenticate('facebook', {
      scope: ['email']
    }));
  app.route('/api/auth/facebook/callback').all(usersPolicy.isAllowed)
    .get(users.oauthCallback('facebook'));

  // Setting the twitter oauth routes
  app.route('/api/auth/twitter').all(usersPolicy.isAllowed)
    .get(passport.authenticate('twitter'));
  app.route('/api/auth/twitter/callback').all(usersPolicy.isAllowed)
    .get(users.oauthCallback('twitter'));

  // Setting the github oauth routes
  app.route('/api/auth/github').all(usersPolicy.isAllowed)
    .get(passport.authenticate('github'));
  app.route('/api/auth/github/callback').all(usersPolicy.isAllowed)
    .get(users.oauthCallback('github'));

};
