import userAuthentication from '../controllers/users.authentication.server.controller.js';
import userPassword from '../controllers/users.password.server.controller.js';
import targetedRequestLimit from '../../../core/server/middleware/targeted-request-limit.server.middleware.js';

/**
 * Module dependencies.
 */

const defaultExport = function (app) {
  // Confirm users email
  app
    .route('/api/auth/confirm-email/:token')
    .get(userAuthentication.validateEmailToken)
    .post(userAuthentication.confirmEmail);

  // Resend email confirmation
  app
    .route('/api/auth/resend-confirmation')
    .post(
      targetedRequestLimit.resendConfirmation,
      userAuthentication.resendConfirmation,
    );

  // Setting up the users password api
  app
    .route('/api/auth/forgot')
    .post(targetedRequestLimit.forgotPassword, userPassword.forgot);
  app
    .route('/api/auth/reset/:token')
    .get(userPassword.validateResetToken)
    .post(targetedRequestLimit.resetPassword, userPassword.reset);

  // Setting up the users authentication api
  app.route('/api/auth/signup').post(userAuthentication.signup);
  app
    .route('/api/auth/signup/validate')
    .post(userAuthentication.signupValidation);
  app
    .route('/api/auth/signin')
    .post(targetedRequestLimit.signin, userAuthentication.signin);
  app.route('/api/auth/signout').post(userAuthentication.signout);

  // Validate username
};
export default defaultExport;
