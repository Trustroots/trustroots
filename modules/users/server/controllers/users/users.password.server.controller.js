'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    config = require(path.resolve('./config/config')),
    passport = require('passport'),
    nodemailer = require('nodemailer'),
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
              done(err, token, user);
            });
          }
        });
      } else {
        return res.status(400).send({
          message: 'Please, we really need your username or email first...'
        });
      }
    },

    // Prepare HTML email
    function(token, user, done) {

      var url = (config.https ? 'https' : 'http') + '://' + req.headers.host;
      var renderVars = {
        name: user.displayName,
        email: user.email,
        ourMail: config.mailer.from,
        urlConfirm: url + '/auth/reset/' + token,
        url: url
      };

      res.render(path.resolve('./modules/core/server/views/email-templates/reset-password'), renderVars, function(err, emailHTML) {
        done(err, emailHTML, user, renderVars);
      });
    },

    // Prepare TEXT email
    function(emailHTML, user, renderVars, done) {
      res.render(path.resolve('./modules/core/server/views/email-templates-text/reset-password'), renderVars, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, user);
      });
    },

    // If valid email, send reset email using service
    function(emailHTML, emailPlain, user, done) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);

      var mailOptions = {
        to: {
          name: user.displayName,
          address: user.email
        },
        from: 'Trustroots <' + config.mailer.from + '>',
        subject: 'Password Reset',
        html: emailHTML,
        text: emailPlain
      };

      smtpTransport.sendMail(mailOptions, function(err) {
        if (!err) {
          res.send({
            message: 'We sent you and email with further instructions. If you don\'t see this email in your inbox within 15 minutes, look for it in your junk mail folder. If you find it there, please mark it as "Not Junk".'
          });
        } else {
          res.status(400).send({
            message: 'Failure while sending recovery email to you. Please try again later.'
          });
        }
        smtpTransport.close(); // close the connection pool

        done(err);
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

    res.redirect('/password/reset/' + req.params.token);
  });
};

/**
 * Reset password POST from email token
 */
exports.reset = function(req, res, next) {
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
                    res.status(400).send(err);
                  } else {
                    // Return authenticated user
                    res.json(user);

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

    // Prepare HTML email
    function(user, done) {

      var renderVars = {
        name: user.displayName,
        ourMail: config.mailer.from,
        url: (config.https ? 'https' : 'http') + '://' + req.headers.host
      };

      res.render(path.resolve('./modules/core/server/views/email-templates/reset-password-confirm'), renderVars, function(err, emailHTML) {
        done(err, emailHTML, user, renderVars);
      });
    },

    // Prepare TEXT email
    function(emailHTML, user, renderVars, done) {
      res.render(path.resolve('./modules/core/server/views/email-templates-text/reset-password-confirm'), renderVars, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, user);
      });
    },

    // If valid email, send reset email using service
    function(emailHTML, emailPlain, user, done) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);

      var mailOptions = {
        to: {
          name: user.displayName,
          address: user.email
        },
        from: 'Trustroots <' + config.mailer.from + '>',
        subject: 'Your password has been changed',
        html: emailHTML
      };

      smtpTransport.sendMail(mailOptions, function(err) {
        smtpTransport.close(); // close the connection pool
        done(err);
      });
    }
  ], function(err) {
    if (err) return next(err);
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
      if(!req.user) {
        return res.status(403).send({
          message: errorHandler.getErrorMessageByKey('forbidden')
        });
      }

      // Check if we have new password coming up
      if (!req.body.newPassword) {
        done(new Error('Please provide a new password.'));
      }

      // Check if new password matches verification
      if (req.body.newPassword !== req.body.verifyPassword) {
        done(new Error('Passwords do not match.'));
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
        if (!err) {
          res.send({
            user: user,
            message: 'Password changed successfully!'
          });
        }
        done(err, user);
      });

    },

    // Prepare HTML email
    function(user, done) {

      var renderVars = {
        name: user.displayName,
        ourMail: config.mailer.from,
        url: (config.https ? 'https' : 'http') + '://' + req.headers.host
      };

      res.render(path.resolve('./modules/core/server/views/email-templates/reset-password-confirm'), renderVars, function(err, emailHTML) {
        done(err, emailHTML, user, renderVars);
      });
    },

    // Prepare TEXT email
    function(emailHTML, user, renderVars, done) {
      res.render(path.resolve('./modules/core/server/views/email-templates-text/reset-password-confirm'), renderVars, function(err, emailPlain) {
        done(err, emailHTML, emailPlain, user);
      });
    },

    // If valid email, send reset email using service
    function(emailHTML, emailPlain, user, done) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);

      var mailOptions = {
        to: {
          name: user.displayName,
          address: user.email
        },
        from: 'Trustroots <' + config.mailer.from + '>',
        subject: 'Your password has been changed',
        html: emailHTML
      };

      smtpTransport.sendMail(mailOptions, function(err) {
        smtpTransport.close(); // close the connection pool
        done(err);
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
