/**
 * Module dependencies.
 */
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const analyticsHandler = require(path.resolve(
  './modules/core/server/controllers/analytics.server.controller',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const profileHandler = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const log = require(path.resolve('./config/lib/logger'));
const async = require('async');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');

/**
 * Forgot for reset password (forgot POST)
 */
exports.forgot = function (req, res, next) {
  async.waterfall(
    [
      // Generate random token
      function (done) {
        crypto.randomBytes(20, function (err, buffer) {
          const token = buffer.toString('hex');
          done(err, token);
        });
      },

      // Lookup user by username
      function (token, done) {
        // Missing username, return error
        if (!req.body.username) {
          return res.status(400).send({
            message: 'Please, we really need your username or email first...',
          });
        }

        const userHandle = req.body.username.toString().toLowerCase();

        User.findOne(
          {
            $or: [{ username: userHandle }, { email: userHandle }],
          },
          '-salt -password',
          function (err, user) {
            if (!user) {
              // Report failure to reset to stats
              return statService.stat(
                {
                  namespace: 'passwordReset',
                  counts: {
                    count: 1,
                  },
                  tags: {
                    status: 'failed:noUser',
                  },
                },
                function () {
                  // Return failure
                  res.status(404).send({
                    message:
                      'We could not find an account with that username or email. Make sure you have it spelled correctly.',
                  });
                },
              );
            } else {
              user.resetPasswordToken = token;
              user.resetPasswordExpires = Date.now() + 24 * 3600000; // 24 hours

              user.save(function (err) {
                done(err, user);
              });
            }
          },
        );
      },

      // Send email
      function (user) {
        emailService.sendResetPassword(user, function (err) {
          // Stop on errors
          if (err) {
            return res.status(400).send({
              message:
                'Failure while sending recovery email to you. Please try again later.',
            });
          }

          // Report successfull reset to stats
          return statService.stat(
            {
              namespace: 'passwordReset',
              counts: {
                count: 1,
              },
              tags: {
                status: 'emailSent',
              },
            },
            function () {
              // Return success
              res.send({
                message: 'We sent you an email with further instructions.',
              });
            },
          );
        });
      },
    ],
    function (err) {
      if (err) {
        return next(err);
      }
    },
  );
};

/**
 * Reset password GET from email token
 */
exports.validateResetToken = function (req, res) {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    },
    function (err, user) {
      if (!user) {
        return res.redirect('/password/reset/invalid');
      }

      let passwordResetUrl = '/password/reset/' + req.params.token;

      // Re-apply possible UTM variables to the redirect URL
      if (
        req.query &&
        req.query.utm_source &&
        req.query.utm_medium &&
        req.query.utm_campaign
      ) {
        passwordResetUrl = analyticsHandler.appendUTMParams(passwordResetUrl, {
          source: req.query.utm_source,
          medium: req.query.utm_medium,
          campaign: req.query.utm_campaign,
        });
      }

      res.redirect(passwordResetUrl);
    },
  );
};

/**
 * Reset password POST from email token
 */
exports.reset = function (req, res) {
  // Init Variables
  const passwordDetails = req.body;

  async.waterfall(
    [
      function (done) {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: {
              $gt: Date.now(),
            },
          },
          function (err, user) {
            // Can't find user (=invalid or expired token) or other error
            if (err || !user) {
              return res.status(400).send({
                message: 'Password reset token is invalid or has expired.',
              });
            }

            // Passwords don't match
            if (
              passwordDetails.newPassword !== passwordDetails.verifyPassword
            ) {
              return res.status(400).send({
                message: 'Passwords do not match.',
              });
            }

            // Change password
            user.password = passwordDetails.newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.passwordUpdated = Date.now();

            // Save user with new password
            user.save(function (err) {
              // Error saving user
              if (err) {
                return res.status(400).send({
                  message: 'Password reset failed.',
                });
              }

              done(null, user);
            });
          },
        );
      },

      // Authenticate
      function (user, done) {
        req.login(user, function (err) {
          // Could not authenticate
          if (err) {
            // Log the failure
            log(
              'error',
              'Authenticating user after password reset failed #910jj3',
              {
                error: err,
              },
            );

            // Stop here
            return done(err);
          }

          // All good, continue
          done(null, user);
        });
      },

      // Send email
      function (user, done) {
        emailService.sendResetPasswordConfirm(
          {
            displayName: user.displayName,
            email: user.email,
          },
          function (err) {
            // Just log errors, but don't mind about them
            // as this is not critical step
            if (err) {
              // Log the failure to send the email
              log(
                'error',
                'Sending notification about password reset failed #30lfbv',
                {
                  error: err,
                },
              );
            }

            done(null, user);
          },
        );
      },

      // Return authenticated user
      function (user) {
        return res.json(profileHandler.sanitizeProfile(user, user));
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: 'Password reset failed.',
        });
      }
    },
  );
};

/**
 * Change Password
 */
exports.changePassword = function (req, res) {
  async.waterfall(
    [
      // Some simple validations before proceeding
      function (done) {
        // Return error if no user
        if (!req.user) {
          return res.status(403).send({
            message: errorService.getErrorMessageByKey('forbidden'),
          });
        }

        // Check if we have new password coming up
        if (!req.body.newPassword) {
          return done(new Error('Please provide a new password.'));
        }

        // Check if new password matches verification
        if (req.body.newPassword !== req.body.verifyPassword) {
          return done(new Error('Passwords do not match.'));
        }

        done(null);
      },

      // Find currently logged in user
      function (done) {
        User.findById(req.user.id, function (err, user) {
          done(err, user);
        });
      },

      // Authenticate with old password to check if it was correct
      function (user, done) {
        if (user.authenticate(req.body.currentPassword)) {
          done(null, user);
        } else {
          done(new Error('Current password is incorrect.'));
        }
      },

      // Save user with new password
      function (user, done) {
        user.password = req.body.newPassword;
        user.passwordUpdated = Date.now();

        user.save(function (err) {
          done(err, user);
        });
      },

      // Login again and return new user
      function (user, done) {
        req.login(user, function (err) {
          if (err) return done(err);
          done(null, user);
        });
      },

      // Send email
      function (user, done) {
        emailService.sendResetPasswordConfirm(user, function (err) {
          if (err) return done(err);
          return res.send({
            user,
            message: 'Password changed successfully!',
          });
        });
      },
    ],
    function (err) {
      if (err) {
        res.status(err.status || 400).send({
          message: err.message || errorService.getErrorMessageByKey('default'),
        });
      }
    },
  );
};
