'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    profileHandler = require(path.resolve('./modules/users/server/controllers/users/users.profile.server.controller')),
    passport = require('passport'),
    async = require('async'),
    crypto = require('crypto'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

/**
 * Signup
 */
exports.signup = function(req, res) {
  async.waterfall([

    // Check if we have the required data before hitting more strict validations at Mongo
    function(done) {

      if (!req.body.firstName || !req.body.lastName || !req.body.username || !req.body.password || !req.body.email) {
        return res.status(400).send({
          message: 'Please provide required fields.'
        });
      }

      done();
    },

    // Generate random token
    function(done) {
      crypto.randomBytes(20, function(err, buffer) {
        var token = buffer.toString('hex');
        done(err, token);
      });
    },

    // Save user
    function(token, done) {

      // For security measurement we remove the roles from the `req.body` object
      delete req.body.roles;

      // These shouldn't be there neither
      delete req.body.avatarUploaded;
      delete req.body.created;
      delete req.body.updated;

      var user = new User(req.body);

      // Add missing user fields
      user.emailToken = token;
      user.public = false;
      user.provider = 'local';
      user.displayName = user.firstName.trim() + ' ' + user.lastName.trim();
      user.displayUsername = req.body.username;

      // Just to simplify email confirm process later
      // This field is normally needed when changing email after the signup process
      // Since we set user public=false and require initial email confirmation,
      // we'll have to have the email also at emailTemporary field
      // (from where it's then again moved to email field)
      user.emailTemporary = user.email;

      // Then save the user
      user.save(function(err) {
        if (!err) {
          // Remove sensitive data before login
          user.password = undefined;
          user.salt = undefined;
        }

        done(err, user);

      });

    },

    // Send email
    function(user, done) {
      emailService.sendSignupEmailConfirmation(user, function(err) {
        done(err, user);
      });
    },

    // Login
    function(user, done) {
      req.login(user, function(err) {
        if (!err) {
          // Remove sensitive data befor sending user
          user = profileHandler.sanitizeProfile(user);
          return res.json(user);
        }
        done(err);
      });
    }

  ], function(err) {
    if (err) {
      console.error(err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
};


/**
 * Signin after passport authentication
 */
exports.signin = function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err || !user) {
      res.status(400).send(info);
    } else {
      // Remove sensitive data before login
      user.password = undefined;
      user.salt = undefined;

      req.login(user, function(err) {
        if (err) {
          res.status(400).send(err);
        } else {
          user = profileHandler.sanitizeProfile(user);
          res.json(user);
        }
      });
    }
  })(req, res, next);
};

/**
 * Signout
 */
exports.signout = function(req, res) {
  req.logout();
  res.redirect('/');
};

/**
 * OAuth callback
 */
exports.oauthCallback = function(strategy) {
  return function(req, res, next) {
    passport.authenticate(strategy, function(err, user, redirectURL) {
      if (err || !user) {
        return res.redirect('/signin');
      }
      req.login(user, function(err) {
        if (err) {
          return res.redirect('/signin');
        }

        return res.redirect(redirectURL || '/profile/' + user.username + '/edit');
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
exports.saveOAuthUserProfile = function(req, providerUserProfile, done) {
  if (!req.user) {
    return done(new Error('You must be logged in to connect to other networks.'), null);
  } else {
    // User is already logged in, join the provider data to the existing user
    var user = req.user;

    // Check if user exists, is not signed in using this provider, and doesn't have that provider data already configured
    if (user.provider !== providerUserProfile.provider && (!user.additionalProvidersData || !user.additionalProvidersData[providerUserProfile.provider])) {
      // Add the provider data to the additional provider data field
      if (!user.additionalProvidersData) user.additionalProvidersData = {};
      user.additionalProvidersData[providerUserProfile.provider] = providerUserProfile.providerData;

      // Then tell mongoose that we've updated the additionalProvidersData field
      user.markModified('additionalProvidersData');

      // And save the user
      user.save(function(err) {
        return done(err, user, '/profile/' + user.username);
      });
    } else {
      return done(new Error('You are already connected using this network.'), user);
    }
  }
};

/**
 * Remove OAuth provider
 */
exports.removeOAuthProvider = function(req, res) {

  // Return error if no user
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Return error if no provider or wrong provider
  if (!req.params.provider || !_.includes(['github', 'facebook', 'twitter'], req.params.provider)) {
    return res.status(400).send({
      message: 'No provider defined.'
    });
  }

  var user = req.user;
  var provider = req.params.provider;

  if (user && provider) {
    // Delete the additional provider
    if (user.additionalProvidersData[provider]) {
      delete user.additionalProvidersData[provider];

      // Then tell mongoose that we've updated the additionalProvidersData field
      user.markModified('additionalProvidersData');
    }

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
            res.json(user);
          }
        });
      }
    });
  }
};

/**
 * Confirm email GET from email token
 */
exports.validateEmailToken = function(req, res) {

  User.findOne({
    emailToken: req.params.token
  }, function(err, user) {
    if (!user) {
      return res.redirect('/confirm-email-invalid');
    }
    res.redirect('/confirm-email/' + req.params.token);
  });
};

/**
 * Confirm email POST from email token
 */
exports.confirmEmail = function(req, res) {
  async.waterfall([

    function(done) {

      // Check if user exists with this token
      User.findOne({
        emailToken: req.params.token
      }, function(err, user) {
        if (!err && user) {

          // Will be the returned object when no errors
          var result = {};

          // If users profile was hidden, it means it was first confirmation email after registration.
          result.profileMadePublic = !user.public;

          done(null, result, user);

        } else {
          return res.status(400).send({
            message: 'Email confirm token is invalid or has expired.'
          });
        }
      });
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
            emailToken: 1
          },
          $set: {
            public: true,
            // Replace old email with new one
            email: user.emailTemporary,
            // @todo: this should be done at user.server.model.js
            emailHash: crypto.createHash('md5').update(user.emailTemporary.trim().toLowerCase()).digest('hex')
          }
        },
        {
          // Return the document after updates if `new = true`
          new: true
        },
        function (err, modifiedUser) {
          done(err, result, modifiedUser);
        });
    },

    function (result, user, done) {
      req.login(user, function(err) {
        done(err, result, user);
      });
    },

    function (result, user) {

      // Return authenticated user
      result.user = user.toObject();

      // Remove some fields before returning user
      delete result.user.resetPasswordToken;
      delete result.user.resetPasswordExpires;
      delete result.user.emailToken;
      delete result.user.password;
      delete result.user.salt;

      return res.json(result);
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
 * Resend email confirmation token
 */
exports.resendConfirmation = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
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
      message: 'Already confirmed.'
    });
  }

  var isEmailChange = !!req.user.public;

  async.waterfall([

    // Generate random token
    function(done) {
      crypto.randomBytes(20, function(err, buffer) {
        if (err) return done(err);
        done(null, buffer.toString('hex'));
      });
    },

    // Save token
    function(token, done) {
      var user = req.user;
      user.updated = Date.now();
      user.emailToken = token;
      user.save(function(err) {
        if (err) return done(err);
        done(null, token, user);
      });
    },

    // Send email
    function(token, user, done) {
      if (isEmailChange) {
        emailService.sendChangeEmailConfirmation(user, function(err) {
          done(err, user);
        });
      } else {
        // signup confirmation
        emailService.sendSignupEmailConfirmation(user, function(err) {
          done(err, user);
        });
      }
    },

    // Return confirmation
    function() {
      return res.json({ message: 'Sent confirmation email.' });
    }

  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });

};
