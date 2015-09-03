'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    config = require(path.resolve('./config/config')),
    nodemailer = require('nodemailer'),
    async = require('async'),
    crypto = require('crypto'),
    sanitizeHtml = require('sanitize-html'),
    lwip = require('lwip'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact');

// Fields to send publicly about any user profile
// to make sure we're not sending unsecure content (eg. passwords)
// Pick here fields to send
exports.userProfileFields = [
                    'id',
                    'displayName',
                    'username',
                    'displayUsername',
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
                    'avatarUploaded',
                    'extSitesBW', // BeWelcome username
                    'extSitesCS', // CouchSurfing username
                    'extSitesWS', // WarmShowers username
                    'emailHash', // MD5 hashed email to use with Gravatars
                    'additionalProvidersData.facebook.id', // For FB avatars and profile links
                    'additionalProvidersData.twitter.screen_name', // For Twitter profile links
                    'additionalProvidersData.github.login' // For GitHub profile links
                    ].join(' ');

// Restricted set of profile fields when only really "miniprofile" is needed
exports.userMiniProfileFields = [
                    'id',
                    'updated', // Used as local-avatar cache buster
                    'displayName',
                    'username',
                    'displayUsername',
                    'avatarSource',
                    'avatarUploaded',
                    'emailHash',
                    'additionalProvidersData.facebook.id' // For FB avatars
                    ].join(' ');

// Mini + a few fields we'll need at listings
exports.userListingProfileFields = exports.userMiniProfileFields + ' birthdate gender tagline';

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
    allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel', 'irc' ]
  };


/**
 * Upload user avatar
 */
exports.uploadAvatar = function (req, res) {

  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  var userId = req.user._id,
      acceptedImagesRegex = /\.(gif|jpe?g|png|GIF|JPE?G|PNG)/i,
      uploadsDir = '/modules/users/img/profile/uploads',
      uploadsPath = path.resolve('./modules/users/client/img/profile/uploads'), // Returns path without trailing slash!
      options = {
        tmpDir:  uploadsPath + '/' + userId + '/tmp/', // tmp dir to upload files to
        uploadDir: uploadsPath + '/' + userId + '/avatar/', // actual location of the file
        uploadUrl: uploadsDir + '/' + userId + '/avatar/', // end point for delete route
        acceptFileTypes: acceptedImagesRegex,
        inlineFileTypes: acceptedImagesRegex,
        imageTypes: acceptedImagesRegex,
        copyImgAsThumb: false, // required
        minFileSize: 1024, // 1kb
        maxFileSize: config.maxUploadSize,
        maxPostSize: config.maxUploadSize,
        imageVersions: {
          maxWidth: 2048,
          maxHeight: 'auto',
          // These could be enabled once package doesn't just resize, but also crops images
          // Until that we're doing thumbnails manually
          // @link https://github.com/arvindr21/blueimp-file-upload-expressjs/issues/29
          /*
          '512': { width : 512, height : 512 },
          '256': { width : 256, height : 256 },
          '128': { width : 128, height : 128 },
          '64': { width : 64, height : 64 },
          '32': { width : 32, height : 32 }
          */
        },
        accessControl: {
          allowOrigin: '*',
          allowMethods: 'OPTIONS, HEAD, POST', //GET, PUT, DELETE
          allowHeaders: 'Content-Type, Content-Range, Content-Disposition'
        },
        storage: {
          type: 'local'
        },
        useSSL: config.https
      },
      uploader = require('blueimp-file-upload-expressjs')(options);

  /**
   * Process uploaded file
   */
  async.waterfall([

    // Make tmp directory
    function(done) {
      mkdirp(options.tmpDir, function (err) {
        done(err);
      });
    },

    // Make upload directory
    function(done) {
      mkdirp(options.uploadDir, function (err) {
        done(err);
      });
    },

    // Make the upload
    function(done) {
      uploader.post(req, res, function (err, obj, redirect) {

        // Send error status 422 - Unprocessable Entity
        if(err || obj.files.length === 0 || (obj.files[0] && obj.files[0].error)) {
          return res.status(422).send({
            message: errorHandler.getErrorMessageByKey('unprocessable-entity')
          });
        }

        done(err, obj);
      });
    },

    // Open the image
    function(obj, done) {
      lwip.open(options.uploadDir + '/' + obj.files[0].name, function(err, image){
        done(err, image, obj);
      });
    },

    // Create orginal jpg file
    function(image, obj, done) {
      image.batch()
      .writeFile(options.uploadDir + 'original.jpg', 'jpg', {quality: 90}, function(err, image, res) {
        done(err, image, obj);
      });
    },

    // Delete the uploaded file
    function(image, obj, done) {
      fs.unlink(options.uploadDir + '/' + obj.files[0].name, function (err) {
        done(err, image, obj);
      });
    },

    // Make the thumbnails
    function(image, obj, done) {

      // Note that each() spawns these functions in order but they are processed asynchronously
      _.each([512, 256, 128, 64, 32], function(size, index, list) {
        lwip.open(options.uploadDir + 'original.jpg', function(err, image) {
          if(!err) {
            var square = Math.min(image.width(), image.height());
            image
              .batch()
              .crop(square, square)
              .resize(size, size)
              .writeFile(options.uploadDir + size +'.jpg', 'jpg', {quality: 90}, function(err, image) {
                // Shorten list so we can keep track on processed count (doesn't keep track on WHICH sizes has been processed)
                list.pop();
                // Finish on errors & when list is empty (=all sizes done)
                if(err || list.length === 0) {
                  done(err, obj);
                }
              });
          }
          else {
            done(err);
          }
        });
      });
    },

    // Send response
    function(obj, done) {
      return res.json(obj);
    }

  // Catch errors
  ], function(err) {
    if(err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });

};



/**
 * Update
 */
exports.update = function(req, res) {

  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  async.waterfall([

  // Generate random token
  function(done) {

    // Generate only if email changed
    if(req.body.email !== req.user.email) {
      crypto.randomBytes(20, function(err, buffer) {
        var token = buffer.toString('hex');
        done(err, token, req.body.email);
      });
    }
    // Email didn't change, just continue
    else {
      done(null, false, false);
    }
  },

  // Update user
  function(token, email, done) {

    // For security measurement remove these from the req.body object
    // Users aren't allowed to modify these directly
    delete req.body.public;
    delete req.body.created;
    delete req.body.seen;
    delete req.body.roles;
    delete req.body.email;
    delete req.body.emailHash;
    delete req.body.emailToken;
    delete req.body.emailTemporary;
    delete req.body.provider;
    delete req.body.username;
    delete req.body.displayUsername;
    delete req.body.salt;
    delete req.body.password;
    delete req.body.resetPasswordToken;
    delete req.body.resetPasswordExpires;
    delete req.body.additionalProvidersData;

    // Merge existing user
    var user = req.user;
    user = _.extend(user, req.body);
    user.updated = Date.now();
    user.displayName = user.firstName + ' ' + user.lastName;

    // This is set only if user edited email
    if(token && email) {
      user.emailToken = token;
      user.emailTemporary = email;
    }

    // Sanitize user description
    user.description = sanitizeHtml(user.description, userSanitizeOptions);

    // Test in case description or tagline are actually empty without html
    // This happens sometimes with wysiwyg editors
    if(user.description && user.description.length > 0 && sanitizeHtml(user.description, {allowedTags: []}).trim() === '') {
      user.description = '';
    }
    if(user.tagline && user.tagline.length > 0 && sanitizeHtml(user.tagline, {allowedTags: []}).trim() === '') {
      user.tagline = '';
    }

    user.save(function(err) {
      if (!err) {
        req.login(user, function(err) {
          if (err) {
            done(err);
          } else {
            user = user.toObject();
            delete user.salt;
            delete user.password;
            delete user.resetPasswordToken;
            delete user.resetPasswordExpires;
            delete user.emailToken;
            res.json(user);
          }
        });
      }
      done(err, token, user);
    });

  },

  // Prepare TEXT mail
  function(token, user, done) {

    // If no token, user didn't change email = pass this phase
    if(token) {

      var url = (config.https ? 'https' : 'http') + '://' + req.headers.host;
      var renderVars = {
        url: url,
        name: user.displayName,
        email: user.emailTemporary,
        urlConfirm: url + '/confirm-email/' + token
      };

      res.render(path.resolve('./modules/core/server/views/email-templates-text/email-confirmation'), renderVars, function(err, emailPlain) {
        done(err, emailPlain, user, renderVars);
      });
    }
    else {
      done(null, false, false, false);
    }
  },

  // Prepare HTML mail
  function(emailPlain, user, renderVars, done) {

    // If no emailPlain, user didn't change email = pass this phase
    if(emailPlain) {
      res.render(path.resolve('./modules/core/server/views/email-templates/email-confirmation'), renderVars, function(err, emailHTML) {
        done(err, emailHTML, emailPlain, user);
      });
    }
    else {
      done(null, false, false, false);
    }
  },

  // If valid email, send confirm email using service
  function(emailHTML, emailPlain, user, done) {

    // If no emailHTML, user didn't change email = pass this phase
    if(emailHTML) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);
      var mailOptions = {
        to: {
          name: user.displayName,
          address: user.emailTemporary
        },
        from: 'Trustroots <' + config.mailer.from + '>',
        subject: 'Confirm email change',
        text: emailPlain,
        html: emailHTML
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        smtpTransport.close(); // close the connection pool
        done(err);
      });
    }
    else {
      done(null);
    }
  },

  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
};

/**
 * Show the profile of the user
 */
exports.getUser = function(req, res) {
  res.json(req.profile || {});
};

/**
 * Show the mini profile of the user
 */
exports.getMiniUser = function(req, res) {

  if(req.profile) {
    // 'public' isn't needed at frontend.
    // We had to bring it until here trough
    // ACL policy since it's needed there.
    var profile = req.profile.toObject();
    delete profile.public;
    res.json(profile);
  }
  else {
    res.json({});
  }

};


/**
 * Mini profile middleware
 */
exports.userMiniByID = function(req, res, next, userId) {

  // Not a valid ObjectId
  if(!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  User.findById(userId, exports.userMiniProfileFields + ' public').exec(function(err, profile) {

    // Something went wrong
    if(err) {
      return next(err);
    }

    // No such user
    if(!profile || !profile.public) {
      return res.status(404).send({
        message: errorHandler.getErrorMessageByKey('not-found')
      });
    }

    req.profile = profile;
    next();

  });
};

/**
 * Profile middleware
 */
exports.userByUsername = function(req, res, next, username) {

  var query;

  // Require user
  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Proper 'username' value required
  if(typeof username !== 'string' || username === '' || username.length < 3) {
    return res.status(400).send({
      message: 'Valid username required.'
    });
  }

  // Got userId instead? Make it work!
  // This is here because previously some API paths used userId instead of username
  // This ensures they work during the transition
  if(mongoose.Types.ObjectId.isValid(username)) {
    console.warn('userByUsername: Found user id when expecting username.');
    query = {
      _id: username
    };
  }
  else {
    query = {
      username: username.toLowerCase()
    };
  }

  async.waterfall([

    // Find user
    function(done) {
      User.findOne(
        query,
        exports.userProfileFields + ' public').exec(function(err, profile) {

        // Something went wrong or no such user
        if (err) {
          done(err);
        }
        // User's own profile
        else if( (profile && req.user) && (profile._id.toString() === req.user._id.toString()) ) {
          done(err, profile.toObject());
        }
        // Not own profile, but not public either
        else if( (profile && req.user) && (profile._id.toString() !== req.user._id.toString()) ) {
          done(err, profile.toObject());
        }
        // No such user
        else if(!profile) {
          return res.status(404).send({
            message: errorHandler.getErrorMessageByKey('not-found')
          });
        }
        else {
          // This isn't needed at frontend
          delete profile.public;

          // Transform profile into object so that we can add new fields to it
          done(err, profile.toObject());
        }

      });
    },

    // Check if logged in user has left contact request for this profile
    function(profile, done) {

      // User's own profile?
      if(profile._id.toString() === req.user.id) {
        profile.contact = false;
        done(null, profile);
      }
      // Check for connection
      else {
        Contact.findOne(
          {
            users: { $all: [ profile._id.toString(), req.user.id ] }
          }
        ).exec(function(err, contact) {
          profile.contact = (contact) ? contact._id : false;
          done(err, profile);
        });
      }
    },

    // Sanitize & return profile
    function(profile, done) {

      if(profile.description) profile.description = sanitizeHtml(profile.description, userSanitizeOptions);

      req.profile = profile;
      next();
    }

  ], function(err) {
    if (err) return next(err);
  });

};
