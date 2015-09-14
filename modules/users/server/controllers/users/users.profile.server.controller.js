'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    config = require(path.resolve('./config/config')),
    nodemailer = require('nodemailer'),
    async = require('async'),
    crypto = require('crypto'),
    sanitizeHtml = require('sanitize-html'),
    lwip = require('lwip'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

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

  // If user is changing email, check if it's available
  function(done) {

    // Check only if email changed
    if(req.body.email !== req.user.email) {
      User.findOne({
        $or: [
          { emailTemporary: req.body.email.toLowerCase() },
          { email: req.body.email.toLowerCase() }
        ]
      }, 'emailTemporary email', function(err, emailUser) {
        // Not free
        if(emailUser) {
          // If the user we found with this email is currently authenticated user, let user pass to resend confirmation email
          if(emailUser._id.equals(req.user._id)) {
            done(null);
          }
          // Otherwise it was someone else's email. Block the way.
          else {
            return res.status(403).send({
              message: 'This email is already in use. Please use another one.'
            });
          }
        }
        // Free, proceed generating the token
        else {
          done(null);
        }
      });
    }
    // Email didn't change, just continue
    else {
      done(null);
    }
  },

  // Check if we should generate new email token
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

    // This is set only if user edited email
    if(token && email) {
      user.emailToken = token;
      user.emailTemporary = email;
    }

    // Sanitize contents coming from wysiwyg editors
    ['description', 'tagline', 'firstName', 'lastName'].forEach(function(key) {
      if(user[key] && key === 'description') {
        // Allow some HTML
        user[key] = textProcessor.html(user[key]);
      }
      // Clean out all HTML
      else if(user[key]) {
        user[key] = textProcessor.plainText(user[key], true);
      }
    });

    // Generate display name
    user.displayName = user.firstName + ' ' + user.lastName;

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

  /**
   * Got userId instead? Make it work!
   * This is here because previously some API paths used userId instead of username
   * This ensures they work during the transition
   * Length must be 24, otherwise we'll get true for 12 characters long usernames
   * Using $or here in case we make false positive with 24 characters long usernames
   */
  if(username.length === 24 && mongoose.Types.ObjectId.isValid(username)) {
    console.warn('userByUsername: Found user id when expecting username.');
    query = {
      $or: [
        { _id: username },
        { username: username.toLowerCase() }
      ]
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

        // Something went wrong
        if (err) {
          done(err);
        }
        // No such user
        else if(!profile) {
          return res.status(404).send({
            message: errorHandler.getErrorMessageByKey('not-found')
          });
        }
        // User's own profile, okay to send with public value in it
        else if( (profile && req.user) && req.user._id.equals(profile._id) ) {
          done(err, profile.toObject());
        }
        // Not own profile and not public
        else if( (profile && req.user) && (!req.user._id.equals(profile._id) && !profile.public) ) {
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

    // Sanitize & return profile
    function(profile, done) {

      // We're sanitizing this already on saving/updating the profile, but here we do it again just in case.
      if(profile.description) profile.description = sanitizeHtml(profile.description, textProcessor.sanitizeOptions);

      req.profile = profile;
      next();
    }

  ], function(err) {
    if (err) return next(err);
  });

};
