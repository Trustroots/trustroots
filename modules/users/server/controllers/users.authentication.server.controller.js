/**
 * Module dependencies.
 */
const _ = require('lodash');
const errorService = require('../../../core/server/services/error.server.service');
const emailService = require('../../../core/server/services/email.server.service');
const userProfile = require('./users.profile.server.controller');
const authenticationService = require('../services/authentication.server.service');
const statService = require('../../../stats/server/services/stats.server.service');
const log = require('../../../../config/lib/logger');
const passport = require('passport');
const async = require('async');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');

function isNameSpam(input) {
  if (
    // The username field says it limits to 34, so apply that to all the fields
    input.length > 34 ||
    input.includes(':') ||
    input.includes('/') ||
    input.includes('_') ||
    input.includes('www') ||
    input.includes('bit.ly')
  ) {
    return true;
  }
  return false;
}

function isUsernameInvalid(input) {
  if (
    input.includes(' ') ||
    input.includes(':') ||
    input.includes('www') ||
    input.includes('/')
  ) {
    return true;
  }
  return false;
}

/**
 * Signup
 */
exports.signup = function (req, res) {
  async.waterfall(
    [
      // Check if we have the required data before hitting more strict validations at Mongo
      function (done) {
        if (
          !req.body.firstName ||
          !req.body.lastName ||
          !req.body.username ||
          !req.body.password ||
          !req.body.email
        ) {
          return done(new Error('Please provide required fields.'));
        }

        done();
      },

      // Simple anti spam check on name input fields
      function (done) {
        const { firstName, lastName, username } = req.body;
        if (
          isNameSpam(firstName) ||
          isNameSpam(lastName) ||
          isNameSpam(username) ||
          isUsernameInvalid(username)
        ) {
          return done(new Error('Invalid signup attempt'));
        }

        done();
      },

      // Generate random token
      function (done) {
        crypto.randomBytes(20, function (err, buffer) {
          const salt = buffer;
          done(err, salt);
        });
      },

      // Save user
      function (salt, done) {
        // For security measurement we remove the roles from the `req.body` object
        delete req.body.roles;

        // These shouldn't be there neither
        delete req.body.avatarUploaded;
        delete req.body.created;
        delete req.body.updated;

        const user = new User(req.body);

        // Add missing user fields
        user.public = false;
        user.provider = 'local';
        user.displayName = user.firstName.trim() + ' ' + user.lastName.trim();

        // Just to simplify email confirm process later
        // This field is normally needed when changing email after the signup process
        // Since we set user public=false and require initial email confirmation,
        // we'll have to have the email also at emailTemporary field
        // (from where it's then again moved to email field)
        user.emailTemporary = user.email;

        user.emailToken = authenticationService.generateEmailToken(user, salt);

        // Then save the user
        user.save(function (err) {
          // Remove sensitive data before login
          user.password = undefined;
          user.salt = undefined;

          done(err, user);
        });
      },

      // Send email
      function (user, done) {
        emailService.sendSignupEmailConfirmation(user, function (err) {
          done(err, user);
        });
      },

      // Login
      function (user, done) {
        req.login(user, function (err) {
          // Remove sensitive data befor sending user
          user = userProfile.sanitizeProfile(user);

          done(err, user);
        });
      },
    ],
    function (err, user) {
      const statsObject = {
        namespace: 'signup',
        counts: {
          count: 1,
        },
        tags: {},
      };

      // Signup process failed
      if (err) {
        // Log the failure to signup
        log('error', 'User signup failed. #fywghg', {
          error: err,
        });

        // Send signup failure to stats servers
        statsObject.tags.status = 'failed';
        statService.stat(statsObject, function () {
          // Send error to the API
          res.status(400).send({
            message: errorService.getErrorMessage(err),
          });
        });

        return;
      }

      // Signup process was successful

      // Send signup success to stats servers
      statsObject.tags.status = 'success';
      statService.stat(statsObject, function () {
        res.json(user || {});
      });
    },
  );
};

/**
 * Signup validation
 */
exports.signupValidation = function (req, res) {
  const username = String(req.body.username || '').toLowerCase();

  async.waterfall(
    [
      // Validate username
      function (done) {
        // Check if we have the required data before hitting more strict validations
        if (!username) {
          return done(
            new Error('Please provide required `username` field.'),
            'username-missing',
          );
        }

        // Is username reserved?
        // You can modify the list from `config/env/default.js`
        if (authenticationService.isUsernameReserved(username)) {
          return done(
            new Error('Username is not available.'),
            'username-not-available-reserved',
          );
        }

        // Is username valid?
        if (!authenticationService.validateUsername(username)) {
          return done(
            new Error('Username is in invalid format.'),
            'username-invalid',
          );
        }

        done();
      },

      // Check username availability against database
      function (done) {
        User.findOne(
          {
            username,
          },
          function (err, user) {
            if (user) {
              return done(
                new Error('Username is not available.'),
                'username-not-available',
              );
            }

            done();
          },
        );
      },
    ],
    function (err, errorCode) {
      const statsObject = {
        namespace: 'signup-validation',
        counts: {
          count: 1,
        },
        tags: {},
      };

      // Signup validation failed
      if (err) {
        // Send signup validation failure to stats servers
        statsObject.tags.status = 'failed';
        statsObject.tags.reason = errorCode || 'other';
        statService.stat(statsObject, function () {
          // Send error to the API
          // HTTP status "200 OK"
          res.status(200).send({
            valid: false,
            error: errorCode || 'other',
            message: err.message || errorService.getErrorMessage(err),
          });
        });

        return;
      }

      // Signup validation was successful

      // Send signup validation success to stats servers
      statsObject.tags.status = 'success';
      statService.stat(statsObject, function () {
        res.status(200).send({
          valid: true,
        });
      });
    },
  );
};

/**
 * Signin after passport authentication
 */
exports.signin = function (req, res, next) {
  const statsObject = {
    namespace: 'signin',
    counts: {
      count: 1,
    },
    tags: {},
  };

  passport.authenticate('local', function (err, user, info) {
    if (err || !user) {
      // Log the failure to signin
      log('error', 'User signin failed. #3tfgbg-1', {
        reason: 'Wrong credentials',
        error: err || null,
      });

      // Send signin failure to stats servers
      statsObject.tags.status = 'failed:wrong-credentials';
      statService.stat(statsObject, function () {
        // Send error to the API
        res.status(400).send(info);
      });

      return;
    }

    // Don't let suspended users sign in
    if (user.roles.includes('suspended')) {
      // Log the failure to signin
      log('error', 'User signin failed. #3tfgbg-2', {
        reason: 'Suspended user',
      });

      // Send signin failure to stats servers
      statsObject.tags.status = 'failed:suspended';
      statService.stat(statsObject, function () {
        // Send error to the API
        res.status(403).send({
          message: errorService.getErrorMessageByKey('suspended'),
        });
      });

      return;
    }

    req.login(user, function (err) {
      if (err) {
        // Log the failure to signin
        log('error', 'User signin failed. #3tfgbg-3', {
          reason: 'Login error',
          error: err,
        });

        // Send signin failure to stats servers
        statsObject.tags.status = 'failed:other';
        statService.stat(statsObject, function () {
          // Send error to the API
          res.status(400).send(err);
        });

        return;
      }

      // Send signin success to stats servers
      statsObject.tags.status = 'success';
      statService.stat(statsObject, function () {
        // Remove sensitive data before sending out
        user = userProfile.sanitizeProfile(user);
        res.json(user);
      });
    });
  })(req, res, next);
};

/**
 * Signout
 */
exports.signout = function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    return res.redirect('/');
  });
};

/**
 * Remove OAuth provider
 */
exports.removeOAuthProvider = function (req, res) {
  // Return error if no user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Return error if no provider or wrong provider
  if (
    !req.params.provider ||
    !_.includes(['github', 'facebook', 'twitter'], req.params.provider)
  ) {
    return res.status(400).send({
      message: 'No provider defined.',
    });
  }

  let user = req.user;
  const provider = req.params.provider;

  // Delete the additional provider
  if (user.additionalProvidersData[provider]) {
    delete user.additionalProvidersData[provider];

    // Then tell mongoose that we've updated the additionalProvidersData field
    user.markModified('additionalProvidersData');
  }

  if (provider === 'facebook' && user.avatarSource === 'facebook') {
    user.avatarSource = 'gravatar';
  }

  user.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err),
      });
    } else {
      req.login(user, function (err) {
        if (err) {
          return res.status(400).send(err);
        }

        // Remove sensitive data before sending out
        user = userProfile.sanitizeProfile(user);
        res.json(user);
      });
    }
  });
};

/**
 * Confirm email GET from email token
 */
exports.validateEmailToken = function (req, res) {
  User.findOne(
    {
      emailToken: req.params.token,
    },
    function (err, user) {
      if (!user) {
        return res.redirect('/confirm-email-invalid');
      }
      res.redirect('/confirm-email/' + req.params.token);
    },
  );
};

/**
 * Confirm email POST from email token
 */
exports.confirmEmail = function (req, res) {
  async.waterfall(
    [
      function (done) {
        // Check if user exists with this token
        User.findOne(
          {
            emailToken: req.params.token,
          },
          function (err, user) {
            if (!err && user) {
              // Will be the returned object when no errors
              const result = {};

              // If users profile was hidden, it means it was first confirmation email after registration.
              result.profileMadePublic = !user.public;

              done(null, result, user);
            } else {
              return res.status(400).send({
                message: 'Email confirm token is invalid or has expired.',
              });
            }
          },
        );
      },

      // Update user
      // We can't do regular `user.save()` here because we've got user document with password and we'd just override it:
      // Instead we'll do normal Mongoose update with previously fetched user ID
      function (result, user, done) {
        User.findOneAndUpdate(
          { _id: user._id },
          {
            $unset: {
              emailTemporary: 1,
              emailToken: 1,
              // Note that `publicReminderCount` and `publicReminderSent` get reset now each
              // time user confirms any email change, even if they didn't confirm their profile yet.
              // That's fine: we'll just start sending 'finish signup' notifications from scratch
              // to the new email. That old email before the change might've been wrong anyway...
              publicReminderCount: 1,
              publicReminderSent: 1,
            },
            $set: {
              public: true,
              // Welcome sequence emails are sent in time intervals
              welcomeSequenceSent: new Date(),
              // Replace old email with new one
              email: user.emailTemporary,
              // @todo: this should be done at user.server.model.js
              emailHash: crypto
                .createHash('md5')
                .update(user.emailTemporary.trim().toLowerCase())
                .digest('hex'),
            },
          },
          {
            // Return the document after updates if `new = true`
            new: true,
          },
          function (err, modifiedUser) {
            done(err, result, modifiedUser);
          },
        );
      },

      function (result, user, done) {
        req.login(user, function (err) {
          done(err, result, user);
        });
      },

      function (result, user) {
        // Return authenticated user
        // Remove sensitive data befor sending user
        result.user = userProfile.sanitizeProfile(user);

        return res.json(result);
      },
    ],
    function (err) {
      /* istanbul ignore else */
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Resend email confirmation token
 */
exports.resendConfirmation = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  /*
    There are two valid cases for getting the confirmation resent:
      1) user is unconfirmed
      2) user is changing email address
    In both cases they will have emailTemporary set
  */
  if (!req.user.emailTemporary) {
    return res.status(400).send({
      message: 'Already confirmed.',
    });
  }

  const isEmailChange = !!req.user.public;

  async.waterfall(
    [
      // Generate random token
      function (done) {
        crypto.randomBytes(20, function (err, buffer) {
          if (err) return done(err);
          done(null, buffer);
        });
      },

      // Save token
      function (salt, done) {
        const user = req.user;
        user.updated = Date.now();
        user.emailToken = authenticationService.generateEmailToken(user, salt);
        user.save(function (err) {
          if (err) return done(err);
          done(null, user);
        });
      },

      // Send email
      function (user, done) {
        if (isEmailChange) {
          emailService.sendChangeEmailConfirmation(user, function (err) {
            done(err, user);
          });
        } else {
          // signup confirmation
          emailService.sendSignupEmailConfirmation(user, function (err) {
            done(err, user);
          });
        }
      },

      // Return confirmation
      function () {
        return res.json({ message: 'Sent confirmation email.' });
      },
    ],
    function (err) {
      /* istanbul ignore else */
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};
