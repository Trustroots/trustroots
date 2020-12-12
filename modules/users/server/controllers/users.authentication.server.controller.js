/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const authenticationService = require(path.resolve(
  './modules/users/server/services/authentication.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const facebook = require(path.resolve('./config/lib/facebook-api.js'));
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));
const moment = require('moment');
const passport = require('passport');
const async = require('async');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');

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
exports.signout = function (req, res) {
  req.logout();
  res.redirect('/');
};

/**
 * OAuth callback
 */
exports.oauthCallback = function (strategy) {
  return function (req, res, next) {
    const defaultRedirectUrl = '/profile/edit/networks';

    passport.authenticate(strategy, function (err, user, redirectURL) {
      if (err) {
        log('error', 'oAuth callback error #h3hg82', {
          strategy,
          err,
        });
        return res.redirect(defaultRedirectUrl);
      }

      if (!user) {
        log('error', 'oAuth callback requires authenticated user #g82bff', {
          strategy,
        });
        return res.redirect('/signin');
      }

      req.login(user, function (err) {
        if (err) {
          log('error', 'oAuth callback failed to login user #h2bgff', {
            strategy,
          });
          return res.redirect('/signin');
        }

        return res.redirect(redirectURL || defaultRedirectUrl);
      });
    })(req, res, next);
  };
};

/**
 * Helper function to update a OAuth user profile
 * Doesn't let users sign up using providers;
 * - They'll first sign up using local.js strategy
 * - Then they can connect their profiles to other networks using other strategies (eg. Twitter)
 */
exports.saveOAuthUserProfile = function (req, providerUserProfile, done) {
  if (!req.user) {
    return done(
      new Error('You must be logged in to connect to other networks.'),
      null,
    );
  } else {
    // User is already logged in, join the provider data to the existing user
    const user = req.user;

    // Check if user exists, is not signed in using this provider, and doesn't have that provider data already configured
    if (
      user.provider !== providerUserProfile.provider &&
      (!user.additionalProvidersData ||
        !user.additionalProvidersData[providerUserProfile.provider])
    ) {
      // Add the provider data to the additional provider data field
      if (!user.additionalProvidersData) user.additionalProvidersData = {};
      user.additionalProvidersData[providerUserProfile.provider] =
        providerUserProfile.providerData;

      // Then tell mongoose that we've updated the additionalProvidersData field
      user.markModified('additionalProvidersData');

      // And save the user
      user.save(function (err) {
        return done(err, user, '/profile/edit/networks');
      });
    } else {
      return done(
        new Error('You are already connected using this network.'),
        user,
      );
    }
  }
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

  if (user && provider) {
    // Delete the additional provider
    if (user.additionalProvidersData[provider]) {
      delete user.additionalProvidersData[provider];

      // Then tell mongoose that we've updated the additionalProvidersData field
      user.markModified('additionalProvidersData');
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
  }
};

/**
 * Update Facebook oAuth token
 */
exports.updateFacebookOAuthToken = function (req, res) {
  // Return error if no accessToken or userID
  if (!req.body.accessToken || !req.body.userID) {
    return res.status(400).send({
      message: 'Missing `accessToken` or `userID`.',
    });
  }

  // No authenticated user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Shorthand for user and avoid need to access `req.user._doc`:
  // http://stackoverflow.com/a/34780800/1984644
  const userObject = req.user.toObject();

  // Currently authenticated user isn't connected to Facebook
  if (!_.has(userObject, 'additionalProvidersData.facebook')) {
    log(
      'error',
      'Currently authenticated user is not connected to Facebook #k2lJRK',
      {
        userId: userObject._id.toString(),
        requestedFbUserId: req.body.userID,
      },
    );
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Currently authenticated user has different FB ID
  if (userObject.additionalProvidersData.facebook.id !== req.body.userID) {
    log(
      'error',
      'Facebook user ids not matching when updating the token #jFiHjf',
      {
        userId: userObject._id.toString(),
        requestedFbUserId: req.body.userID,
      },
    );
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  async.waterfall(
    [
      // Generate long lived token (60 days) out from short lived token (~hours)
      function (done) {
        exports.extendFBAccessToken(req.body.accessToken, done);
      },

      // Save new token to user's profile
      function (accessTokenResponse, done) {
        // We can't use above `userObject` to perform Mongoose's `markModified` or `save` methods
        const user = req.user;

        if (accessTokenResponse.expires) {
          // Update token's expiration date if available
          user.additionalProvidersData.facebook.accessTokenExpires =
            accessTokenResponse.expires;
        } else {
          // Otherwise, delete previously stored date
          delete user.additionalProvidersData.facebook.accessTokenExpires;
        }

        // Update oAuth token
        user.additionalProvidersData.facebook.accessToken =
          accessTokenResponse.token;

        // Then tell mongoose that we've updated the additionalProvidersData field
        user.markModified('additionalProvidersData');

        // Save modified user
        user.save(done);
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      // All done & good
      return res.json({
        message: 'Token updated.',
      });
    },
  );
};

/**
 * Generate a long-lived token (60 days) from a short-lived token (~hours)
 * https://developers.facebook.com/docs/facebook-login/access-tokens/expiration-and-extension
 *
 * An important note: Apps are unable to exchange an expired short-lived token
 * for a long-lived token. The flow here only works with short-lived tokens
 * that are still valid. Once they expire, your app must send the user through
 * the login flow again to generate a new short-lived token.
 *
 * @param {String} shortAccessToken - short lived FB access token
 * @param {Function} callback - `function (err, result)`
 */
exports.extendFBAccessToken = function (shortAccessToken, callback) {
  const fbClientID = _.get(config, 'facebook.clientID');
  const fbClientSecret = _.get(config, 'facebook.clientSecret');

  // Return error if no short-lived access token provided
  if (!shortAccessToken || !_.isString(shortAccessToken)) {
    log('error', 'Missing short-lived access token #tkj0GJ');
    return callback(new Error('Missing access token.'), {});
  }

  // Return error if Facebook connection isn't configured
  if (!fbClientID || !fbClientSecret) {
    log(
      'error',
      'No Facebook client configured when attemping to extend FB access token #FKeo2k',
    );
    return callback(
      new Error(errorService.getErrorMessageByKey('default')),
      {},
    );
  }

  facebook.extendAccessToken(
    {
      access_token: shortAccessToken,
      client_id: fbClientID,
      client_secret: fbClientSecret,
    },
    function (err, accessTokenResponse) {
      if (err) {
        log('error', 'Failed to extend Facebook access token. #JG3jk3', {
          error: err,
        });
        return callback(err);
      }

      const accessToken = _.get(accessTokenResponse, 'access_token');
      const accessTokenExpires = _.get(accessTokenResponse, 'expires_in');

      // Response from FB doesn't include access token
      if (!accessToken) {
        log(
          'error',
          'Missing extended Facebook access token from response. #jlkFLl',
          {
            response: accessTokenResponse,
          },
        );
        return callback(
          new Error(errorService.getErrorMessageByKey('default')),
          {},
        );
      }

      // Callback's response object
      const response = {
        token: accessToken,
      };

      // Response from FB contains `expires_in` in seconds
      // Turn that into a date in future
      if (_.isNumber(accessTokenExpires)) {
        response.expires = moment().add(accessTokenExpires, 'seconds').toDate();
      }

      return callback(err, response);
    },
  );
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
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};
