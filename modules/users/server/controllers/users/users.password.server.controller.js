'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    async = require('async'),
    crypto = require('crypto'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

/**
 * Forgot for reset password (forgot POST)
 */
exports.forgot = function(req, res, next) {
  async.waterfall([
    // Generate random token
    function(done) {
      crypto.randomBytes(20, function(err, buffer) {
        var token = buffer.toString('hex');
        done(err, token);
      });
    },
    // Lookup user by username
    function(token, done) {
      if (req.body.username) {
        var username = req.body.username.toString().toLowerCase();
        User.findOne({
          $or: [
            { username: username.toLowerCase() },
            { email: username.toLowerCase() }
          ]
        }, '-salt -password', function(err, user) {
          if (!user) {
            return res.status(404).send({
              message: 'We could not find an account with that username or email. Make sure you have it spelled correctly.'
            });
          } else {
            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + (24 * 3600000); // 24 hours

            user.save(function(err) {
              done(err, user);
            });
          }
        });
      } else {
        return res.status(400).send({
          message: 'Please, we really need your username or email first...'
        });
      }
    },

    // Send email
    function(user) {
      emailService.sendResetPassword(user, function(err) {
        if (!err) {
          return res.send({
            message: 'Password reset sent.'
          });
        } else {
          return res.status(400).send({
            message: 'Failure while sending recovery email to you. Please try again later.'
          });
        }
      });
    }

  ], function(err) {
    if (err) return next(err);
  });
};

/**
 * Reset password GET from email token
 */
exports.validateResetToken = function(req, res) {
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: {
      $gt: Date.now()
    }
  }, function(err, user) {
    if (!user) {
      return res.redirect('/password/reset/invalid');
    }

    var passwordResetUrl = '/password/reset/' + req.params.token;

    // Re-apply possible UTM variables to the redirect URL
    if (req.query && req.query.utm_source && req.query.utm_medium && req.query.utm_campaign) {
      passwordResetUrl = analyticsHandler.appendUTMParams(passwordResetUrl, {
        source: req.query.utm_source,
        medium: req.query.utm_medium,
        campaign: req.query.utm_campaign
      });
    }

    res.redirect(passwordResetUrl);
  });
};

/**
 * Reset password POST from email token
 */
exports.reset = function(req, res) {
  // Init Variables
  var passwordDetails = req.body;

  async.waterfall([

    function(done) {
      User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
          $gt: Date.now()
        }
      }, function(err, user) {
        if (!err && user) {
          if (passwordDetails.newPassword === passwordDetails.verifyPassword) {
            user.password = passwordDetails.newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              if (err) {
                return res.status(400).send({
                  message: errorHandler.getErrorMessage(err)
                });
              } else {
                req.login(user, function(err) {
                  if (err) {
                    return res.status(400).send(err);
                  } else {
                    done(err, user);
                  }
                });
              }
            });
          } else {
            return res.status(400).send({
              message: 'Passwords do not match.'
            });
          }
        } else {
          return res.status(400).send({
            message: 'Password reset token is invalid or has expired.'
          });
        }
      });
    },

    // Send email
    function(user, done) {
      emailService.sendResetPassword(user, done);
    },

    // Return authenticated user
    function(user) {
      return res.json(user);
    }

  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
};

/**
 * Change Password
 */
exports.changePassword = function(req, res) {

  async.waterfall([

    // Some simple validations before proceeding
    function(done) {

      // Return error if no user
      if (!req.user) {
        return res.status(403).send({
          message: errorHandler.getErrorMessageByKey('forbidden')
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
    function(done) {
      User.findById(req.user.id, function(err, user) {
        done(err, user);
      });
    },

    // Authenticate with old password to check if it was correct
    function(user, done) {
      if (user.authenticate(req.body.currentPassword)) {
        done(null, user);
      } else {
        done(new Error('Current password is incorrect.'));
      }
    },

    // Save user with new password
    function(user, done) {

      user.password = req.body.newPassword;

      user.save(function(err) {
        done(err, user);
      });

    },

    // Login again and return new user
    function(user, done) {

      req.login(user, function(err) {
        if (err) return done(err);
        done(null, user);
      });

    },

    // Send email
    function(user, done) {
      emailService.sendResetPasswordConfirm(user, function(err) {
        if (err) return done(err);
        return res.send({
          user: user,
          message: 'Password changed successfully!'
        });
      });
    }

  ], function(err) {
    if (err) {
      res.status(err.status || 400).send({
        message: err.message || errorHandler.getErrorMessageByKey('default')
      });
    }
  });

};
