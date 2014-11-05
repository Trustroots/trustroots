'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    errorHandler = require('../errors'),
    mongoose = require('mongoose'),
    passport = require('passport'),
    sanitizeHtml = require('sanitize-html'),
    async = require('async'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact'),
    Reference = mongoose.model('Reference');

// Fields to send publicly about any user profile
// to make sure we're not sending unsecure content (eg. passwords)
// Pick here fields to send
exports.userProfileFields = [
                    'id',
                    'displayName',
                    'username',
                    'gender',
                    'tagline',
                    'description',
                    'locationFrom',
                    'locationLiving',
                    'languages',
                    'birthdate',
                    'seen',
                    'created',
                    'updated',
                    'avatarSource',
                    'emailHash' // MD5 hashed email to use with Gravatars
                    ].join(' ');

// Restricted set of profile fields when only really "miniprofile" is needed
exports.userMiniProfileFields = 'id displayName username avatarSource emailHash languages';

/**
* Rules for sanitizing user description coming in and out
* @link https://github.com/punkave/sanitize-html
*/
var userSanitizeOptions = {
    allowedTags: [ 'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'li', 'ul', 'ol', 'blockquote', 'code', 'pre' ],
    allowedAttributes: {
      'a': [ 'href' ],
      // We don't currently allow img itself, but this would make sense if we did:
      //'img': [ 'src' ]
    },
    selfClosing: [ 'img', 'br' ],
    // URL schemes we permit
    allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel' ]
  };

/**
 * Update user details
 */
exports.update = function(req, res) {
  // Init Variables
  var user = req.user;
  var message = null;

  // For security measurement we remove the roles from the req.body object
  delete req.body.roles;

  if (user) {
    // Merge existing user
    user = _.extend(user, req.body);
    user.updated = Date.now();
    user.displayName = user.firstName + ' ' + user.lastName;

    // Sanitize user description
    user.description = sanitizeHtml(user.description, userSanitizeOptions);

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
  } else {
    res.status(400).send({
      message: 'User is not signed in'
    });
  }
};

/**
 * Send User
 */
exports.me = function(req, res) {
  res.json(req.user || null);
};


/**
 * Show the profile of the user
 */
exports.getUser = function(req, res) {
  res.json(req.user || null);
};

/**
 * Show the mini profile of the user
 * Pick only certain fields from whole profile @link http://underscorejs.org/#pick
 */
exports.getMiniUser = function(req, res) {
  res.json( req.user || null );
};


/**
 * List of Profiles
 */
exports.list = function(req, res) {
  User.find().sort('-created').exec(function(err, users) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(users);
    }
  });
};


/**
 * Mini profile middleware
 */
exports.userMiniByID = function(req, res, next, id) {
  User.findById(id, exports.userMiniProfileFields).exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('Failed to load user ' + id));

    req.user = user;
    next();
  });
};

exports.userByUsername = function(req, res, next, username) {

  async.waterfall([

    // Find user
    function(done) {
      User.findOne({
          username: username
      }, exports.userProfileFields).exec(function(err, user) {
        if (!user) done(new Error('Failed to load user ' + username));

        // Transform user into object so that we can add new fields to it
        done(err, user.toObject());
      });
    },

    // Check if logged in user has left reference for this profile
    function(user, done) {

      // User's own profile?
      if(user._id.toString() === req.user.id) {
        user.contact = false;
        done(null, user);
      }
      else {
        Contact.findOne(
          {
            users: { $all: [ user._id.toString(), req.user.id ] }
          }
        ).exec(function(err, contact) {
          user.contact = (contact) ? contact._id : false;
          done(err, user);
        });
      }
    },

    // Check if logged in user has left reference for this profile
    function(user, done) {
      Reference.findOne(
        {
          userTo: user._id,
          userFrom: req.user._id
        }
      ).exec(function(err, reference) {
        if(reference) user.reference = reference;
        done(err, user);
      });
    },

    // Sanitize & return user
    function(user, done) {

      if(user.description) user.description = sanitizeHtml(user.description, userSanitizeOptions);

      req.user = user;
      next();
    }

  ], function(err) {
    if (err) return next(err);
  });

};
