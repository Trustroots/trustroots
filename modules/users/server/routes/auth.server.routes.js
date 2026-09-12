/**
 * Module dependencies.
 */
const userAuthentication = require('../controllers/users.authentication.server.controller');
const userPassword = require('../controllers/users.password.server.controller');

module.exports = function (app) {
  // Confirm users email
  app
    .route('/api/auth/confirm-email/:token')
    .get(userAuthentication.validateEmailToken)
    .post(userAuthentication.confirmEmail);

  // Resend email confirmation
  app
    .route('/api/auth/resend-confirmation')
    .post(userAuthentication.resendConfirmation);

  // Setting up the users password api
  app.route('/api/auth/forgot').post(userPassword.forgot);
  app
    .route('/api/auth/reset/:token')
    .get(userPassword.validateResetToken)
    .post(userPassword.reset);

  // Setting up the users authentication api
  app.route('/api/auth/signup').post(userAuthentication.signup);
  app
    .route('/api/auth/signup/validate')
    .post(userAuthentication.signupValidation);
  app.route('/api/auth/signin').post(userAuthentication.signin);
  app.route('/api/auth/signout').get(userAuthentication.signout);

  // Validate username
};
