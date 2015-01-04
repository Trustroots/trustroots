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
    config = require('../../../config/config'),
    nodemailer = require('nodemailer'),
    crypto = require('crypto'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact'),
    Reference = mongoose.model('Reference'),
    lwip = require('lwip'),
    mkdirp = require('mkdirp'),
    fs = require('fs');


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
                    'emailHash', // MD5 hashed email to use with Gravatars
                    'additionalProvidersData.facebook.id', // For FB avatars
                    'additionalProvidersData.facebook.link', // For FB profile links
                    'additionalProvidersData.twitter.screen_name' // For Twitter profile links
                    ].join(' ');

// Restricted set of profile fields when only really "miniprofile" is needed
exports.userMiniProfileFields = 'id displayName username avatarSource emailHash additionalProvidersData.facebook.id';

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
 * Upload user avatar
 */

exports.upload = function (req, res) {
  var userId = req.user._id;
  var options = {
      tmpDir:  __dirname + '/../../../public/modules/users/img/profile/uploads/'+userId+'/tmp/',
      uploadDir: __dirname + '/../../../public/modules/users/img/profile/uploads/'+userId+'/avatar/',
      uploadUrl: '/modules/users/img/profile/uploads/'+userId+'/avatar/',
      minFileSize:  1,
      maxFileSize:  10000000, //10MB
      storage: {
          type: 'local'
      }
  };

  //Create the directories
  mkdirp(options.tmpDir, function (err) {
       if(!err) mkdirp(options.uploadDir, function (err) {
        if(!err) {
          //Upload
          var uploader = require('blueimp-file-upload-expressjs')(options);
          uploader.post(req, res, function (obj) {
            res.send(JSON.stringify(obj));
            lwip.open(options.uploadDir + '/' + obj.files[0].name, function(err, image){
              if(!err) {
                image.batch()
                .writeFile(options.uploadDir + 'original.jpg', 'jpg', {quality: 90}, function(err, image){
                  fs.unlink(options.uploadDir + '/' + obj.files[0].name, function (err) {
                  });
                  var sizes = [512, 256, 128, 64, 32];
                  var sizesLenght = sizes.length;
                  for(var i = 0; i < sizesLenght; i++) {
                    lwip.open(options.uploadDir + 'original.jpg', function(err, image, i){
                      var size = sizes.pop();
                      if(!err) {
                        var square = Math.min(image.width(), image.height());
                        image.batch()
                        .crop(square, square)
                        .resize(size, size)
                        .writeFile(options.uploadDir + size +'.jpg', 'jpg', {quality: 90}, function(err, image){
                        });
                      }
                    });
                  }
                });
              }
            });
          });
        }
      });
  });
};



/**
* Update
*/
exports.update = function(req, res) {
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

    // Init Variables
    var user = req.user;
    var message = null;

    // For security measurement remove these from the req.body object
    // Users aren't allowed to modify these directly
    delete req.body.seen;
    delete req.body.roles;
    delete req.body.email;
    delete req.body.public;
    delete req.body.created;
    delete req.body.username;
    delete req.body.emailToken;
    delete req.body.emailTemporary;
    delete req.body.salt;
    delete req.body.password;
    delete req.body.resetPasswordToken;
    delete req.body.resetPasswordExpires;


    if (user) {
      // Merge existing user
      user = _.extend(user, req.body);
      user.updated = Date.now();
      user.displayName = user.firstName + ' ' + user.lastName;

      // This is set only if user edited also email
      if(token && email) {
        user.emailToken = token;
        user.emailTemporary = email;
      }

      // Sanitize user description
      user.description = sanitizeHtml(user.description, userSanitizeOptions);

      user.save(function(err) {
        if (!err) {
          req.login(user, function(err) {
            if (err) {
              done(err);
            } else {
              delete user.emailToken;
              res.json(user);
            }
          });
        }
        done(err, token, user);
      });
    } else {
      done(new Error('User is not signed in'));
    }

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
        urlConfirm: url + '/#!/confirm-email/' + token
      };

      res.render('email-templates-text/email-confirmation', renderVars, function(err, emailPlain) {
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
      res.render('email-templates/email-confirmation', renderVars, function(err, emailHTML) {
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
        to: user.displayName + ' <' + user.emailTemporary + '>',
        from: config.mailer.from,
        subject: 'Confirm email change',
        text: emailPlain,
        html: emailHTML
      };
      smtpTransport.sendMail(mailOptions, function(err) {
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
 * List of public profiles
 */
exports.list = function(req, res) {

  // If user who is loading is hidden, don't show anything
  if(!req.user || !req.user.public) {
    return res.status(400).send('No access.');
  }

  User.find({public: true}).sort('-created').exec(function(err, users) {
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

  User.findById(id, exports.userMiniProfileFields + ' languages public').exec(function(err, user) {

    // Something went wrong
    if (err) {
      return next(err);
    }
    // No such user
    else if (!user) {
      return next(new Error('Failed to load user ' + id));
    }
    // User's own profile
    else if(user._id.toString() === req.user._id.toString()) {
      req.user = user;
      next();
    }
    // If user to be loaded is hidden OR user who is loading is hidden, don't show anything
    else if(!user.public || !req.user.public) {
      return next(new Error('Failed to load user ' + id));
    }
    else {
      // This isn't needed at frontend
      delete user.public;

      req.user = user;
      next();
    }

  });
};

/**
 * Profile middleware
 */
exports.userByUsername = function(req, res, next, username) {

  async.waterfall([

    // Find user
    function(done) {
      User.findOne({
          username: username
      }, exports.userProfileFields + ' public').exec(function(err, user) {

        // Something went wrong or no such user
        if (err) {
          done(err);
        }
        else if(!user) {
          done(new Error('Failed to load user ' + username));
        }
        // User's own profile
        else if(user._id.toString() === req.user._id.toString()) {
          done(err, user.toObject());
        }
        // If user to be loaded is hidden OR user who is loading is hidden, don't show anything
        else if(user.public === false || req.user.public === false) {
          done(new Error('Failed to load user ' + username));
        }
        else {
          // This isn't needed at frontend
          delete user.public;

          // Transform user into object so that we can add new fields to it
          done(err, user.toObject());
        }

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
