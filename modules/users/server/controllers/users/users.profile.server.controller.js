'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    tribesHandler = require(path.resolve('./modules/tags/server/controllers/tribes.server.controller')),
    tagsHandler = require(path.resolve('./modules/tags/server/controllers/tags.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    pushService = require(path.resolve('./modules/core/server/services/push.server.service')),
    inviteCodeService = require(path.resolve('./modules/users/server/services/invite-codes.server.service')),
    statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    messageStatService = require(path.resolve(
      './modules/messages/server/services/message-stat.server.service')),
    config = require(path.resolve('./config/config')),
    async = require('async'),
    crypto = require('crypto'),
    sanitizeHtml = require('sanitize-html'),
    mkdirRecursive = require('mkdir-recursive'),
    mongoose = require('mongoose'),
    multer = require('multer'),
    fs = require('fs'),
    os = require('os'),
    mmmagic = require('mmmagic'),
    multerConfig = require(path.resolve('./config/lib/multer')),
    User = mongoose.model('User'),
    Tag = mongoose.model('Tag');

// Load either ImageMagick or GraphicsMagick as an image processor
// Defaults to GraphicsMagick
// @link https://github.com/aheckmann/gm#use-imagemagick-instead-of-gm
var imageProcessor = (config.imageProcessor === 'imagemagic') ? require('gm').subClass({ imageMagick: true }) : require('gm');

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
  'member',
  'replyRate',
  'replyTime',
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
exports.userListingProfileFields = exports.userMiniProfileFields + ' member birthdate gender tagline';

/**
 * Middleware to validate+process avatar upload field
 */
exports.avatarUploadField = function (req, res, next) {

  // Create Multer instance
  // - Destination folder will default to `os.tmpdir()` if no configuration path available
  // - Destination filename will default to 16 bytes of
  //   random data as a hex-string (e.g. a087fda2cf19f341ddaeacacab285acc)
  //   without file-extension.
  var upload = multer({
    dest: config.uploadTmpDir || os.tmpdir(),
    limits: {
      fileSize: config.maxUploadSize // max file size in bytes
    },
    fileFilter: multerConfig.uploadFileFilter
  }).single('avatar');

  upload(req, res, function (err) {

    // An error occurred when uploading
    // See Multer default error codes:
    // @link https://github.com/expressjs/multer/blob/master/lib/make-error.js
    if (err) {

      var errorMessage,
          errorStatus;

      if (err.code && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        // Unsupported media type -error
        // This error is generated from ./config/lib/multer.js
        errorMessage = errorHandler.getErrorMessageByKey('unsupported-media-type');
        errorStatus = 415;
      } else if (err.code && err.code === 'LIMIT_FILE_SIZE') {
        // Too big file
        // 413: "Request Entity Too Large"
        errorMessage = 'Image too big. Please maximum ' + (config.maxUploadSize / (1024 * 1024)).toFixed(2) + ' Mb files.';
        errorStatus = 413;
      } else if (err.code && err.code === 'LIMIT_UNEXPECTED_FILE') {
        // Field doesn't exist -error
        errorMessage = 'Missing `avatar` field from the API call.';
        errorStatus = 400;
      } else {
        // Any other error
        errorMessage = errorHandler.getErrorMessageByKey('default');
        errorStatus = 400;
      }

      return res.status(errorStatus).send({
        message: errorMessage
      });
    }

    // Everything went fine
    next();
  });
};


/**
 * Upload user avatar
 */
exports.avatarUpload = function (req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // `req.file` is placed there by Multer middleware.
  // See `users.server.routes.js` for more details.
  if (!req.file || !req.file.path) {
    return res.status(422).send({
      message: errorHandler.getErrorMessageByKey('unprocessable-entity')
    });
  }

  // Each user has their own folder for avatars
  var uploadDir = path.resolve(config.uploadDir) + '/' + req.user._id + '/avatar'; // No trailing slash

  /**
   * Process uploaded file
   */
  async.waterfall([

    // Validate uploaded file using libmagic
    // The check is performed with "magic bytes"
    // @link https://www.npmjs.com/package/mmmagic
    function(done) {
      var Magic = mmmagic.Magic;
      var magic = new Magic(mmmagic.MAGIC_MIME_TYPE);
      magic.detectFile(req.file.path, function(err, result) {
        if (err || (result && multerConfig.validMimeTypes.indexOf(result) === -1)) {
          return res.status(415).send({
            message: errorHandler.getErrorMessageByKey('unsupported-media-type')
          });
        }
        done(err);
      });
    },

    // Ensure user's upload directory exists
    function(done) {
      mkdirRecursive.mkdir(uploadDir, function (err) {
        if (err && err.code !== 'EEXIST') {
          return done(err);
        }
        done();
      });
    },

    // Make the thumbnails
    function(done) {

      var asyncQueueErrorHappened;

      // Create a queue worker
      // @link https://github.com/caolan/async#queueworker-concurrency
      var q = async.queue(function (thumbSize, callback) {
        // Create thumbnail size
        // Images are resized following quality/size -optimization tips from this article:
        // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/
        imageProcessor(req.file.path)
          // .in('jpeg:fancy-upsampling=false')  // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#resampling
          .autoOrient()
          .noProfile()                          // No color profile
          .colorspace('rgb')                    // Not sRGB @link https://ehc.ac/p/graphicsmagick/bugs/331/?limit=25
          .interlace('None')                    // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#progressive-rendering
          .filter('Triangle')                   // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#resampling
          .resize(thumbSize, thumbSize + '^')     // ^ = Dimensions are treated as minimum rather than maximum values. @link http://www.graphicsmagick.org/Magick++/Geometry.html
          .gravity('Center')
          .extent(thumbSize, thumbSize)
          .unsharp(0.25, 0.25, 8, 0.065)        // radius [, sigma, amount, threshold] - @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#sharpening
          .quality(82)                          // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#quality-and-compression
          .write(uploadDir + '/' + thumbSize + '.jpg', function (err) {

            // Something's wrong with the file, stop here.
            if (err) {
              if (process.env.NODE_ENV === 'development') {
                console.error('Error while generating thumbnail ' + thumbSize);
                console.error(err);
              }

              // This stops us sending res multiple times since tasks are running paraller
              if (!asyncQueueErrorHappened) {
                asyncQueueErrorHappened = true;

                // Stop the queue
                q.pause();

                // Attempt to delete tmp file
                fs.unlink(req.file.path, function (err) {
                  if (err) {
                    console.error('Failed to clean out temporary image.');
                    console.error(err);
                  }
                  // @link http://www.restpatterns.org/HTTP_Status_Codes/422_-_Unprocessable_Entity
                  return res.status(422).send({
                    message: 'Failed to process image, please try again.'
                  });
                });
              } else {
                callback(err, thumbSize);
              }
            } else {
              callback(err, thumbSize);
            }
          });
      }, 3); // How many thumbnails to process simultaneously?

      // Start processing these sizes
      q.push([2048, 1024, 512, 256, 128, 64, 32]);

      // Assign a final callback to work queue
      // Done with all the thumbnail sizes, continue...
      q.drain = done;
    },

    // Delete uploaded temp file
    function(done) {
      fs.unlink(req.file.path, function (err) {
        done(err);
      });
    }

  // Catch errors
  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err) || 'Failed to process image, please try again.'
      });
    } else {
      // All Done!
      return res.send({
        message: 'Avatar image uploaded.'
      });
    }
  });
};

/**
 * Update
 */
exports.update = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  async.waterfall([

    // If user is changing email, check if it's available
    function(done) {

      // Check if email changed and proceed with extra checks if so
      if (req.body.email && req.body.email !== req.user.email) {
        User.findOne({
          $or: [
            { emailTemporary: req.body.email.toLowerCase() },
            { email: req.body.email.toLowerCase() }
          ]
        }, 'emailTemporary email', function(err, emailUser) {
          // Not free
          if (emailUser) {
            // If the user we found with this email is currently authenticated user, let user pass to resend confirmation email
            if (emailUser._id.equals(req.user._id)) {
              done(null);
            } else {
              // Otherwise it was someone else's email. Block the way.
              return res.status(403).send({
                message: 'This email is already in use. Please use another one.'
              });
            }
          } else {
            // Free, proceed generating the token
            done(null);
          }
        });
      } else {
        // Email didn't change, just continue
        done(null);
      }
    },

    // Check if we should generate new email token
    function(done) {

      // Generate only if email changed
      if (req.body.email && req.body.email !== req.user.email) {
        crypto.randomBytes(20, function(err, buffer) {
          var token = buffer.toString('hex');
          done(err, token, req.body.email);
        });
      } else {
        // Email didn't change, just continue
        done(null, false, false);
      }
    },

    // Update user
    function(token, email, done) {

      // For security measurement do not use _id from the req.body object
      delete req.body._id;

      // For security measurement remove these from the req.body object
      // Users aren't allowed to modify these directly
      delete req.body.member;
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
      delete req.body.publicReminderCount;
      delete req.body.publicReminderSent;

      // Merge existing user
      var user = req.user;
      user = _.extend(user, req.body);
      user.updated = Date.now();

      // This is set only if user edited email
      if (token && email) {
        user.emailToken = token;
        user.emailTemporary = email;
      }

      // Sanitize string contents
      // `description` field is allowed to contain some html
      ['description',
       'tagline',
       'firstName',
       'lastName',
       'locationLiving',
       'locationFrom',
       'extSitesBW',
       'extSitesCS',
       'extSitesWS'
      ].forEach(function(key) {
        if (user[key] && key === 'description') {
          // Allow some HTML
          user[key] = textProcessor.html(user[key]);
        } else if (user[key]) {
          // Clean out all HTML
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
              done(null, token, user);
            }
          });
        } else {
          done(err, token, user);
        }
      });

    },

    // Send email
    function(token, user, done) {
      if (token) {
        emailService.sendChangeEmailConfirmation(user, function(err) {
          done(err, user);
        });
      } else {
        done(null, user);
      }
    },

    // Return user
    function(user) {
      user = exports.sanitizeProfile(user);
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
 * Show the profile of the user
 */
exports.getUser = function(req, res) {
  // Not a profile of currently authenticated user:
  if (req.profile && !req.user._id.equals(req.profile._id)) {
    // 'public' isn't needed at frontend.
    // We had to bring it until here trough
    // ACL policy since it's needed there.
    // `req.profile.toObject()` is done at sanitizeProfile() before this.
    delete req.profile.public;
    res.json(req.profile);
  } else {
    // Profile of currently authenticated user:
    res.json(req.profile || {});
  }
};

/**
 * Show the mini profile of the user
 */
exports.getMiniUser = function(req, res) {

  if (req.profile) {
    // 'public' isn't needed at frontend.
    // We had to bring it until here trough
    // ACL policy since it's needed there.
    var profile = req.profile.toObject();
    delete profile.public;
    res.json(profile);
  } else {
    res.json({});
  }

};


/**
 * Mini profile middleware
 */
exports.userMiniByID = function(req, res, next, userId) {

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  User.findById(userId, exports.userMiniProfileFields + ' public').exec(function(err, profile) {

    // Something went wrong
    if (err) {
      return next(err);
    }

    // No such user
    if (!profile || !profile.public) {
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

  // Require user
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Proper 'username' value required
  if (typeof username !== 'string' || username.trim() === '' || username.length < 3) {
    return res.status(400).send({
      message: 'Valid username required.'
    });
  }

  async.waterfall([

    // Find user
    function(done) {
      User
        .findOne({
          username: username.toLowerCase()
        },
        exports.userProfileFields + ' public')
        .populate({
          path: 'member.tag',
          select: tribesHandler.tribeFields,
          model: 'Tag'
          // Not possible at the moment due bug in Mongoose
          // http://mongoosejs.com/docs/faq.html#populate_sort_order
          // https://github.com/Automattic/mongoose/issues/2202
          // options: { sort: { count: -1 } }
        })
        .exec(function(err, profile) {
          if (err) {
            // Something went wrong
            done(err);
          } else if (!profile) {
            // No such user
            return res.status(404).send({
              message: errorHandler.getErrorMessageByKey('not-found')
            });
          } else if ((profile && req.user) && req.user._id.equals(profile._id)) {
            // User's own profile, okay to send with public value in it
            done(err, profile);
          } else if ((profile && req.user) && (!req.user._id.equals(profile._id) && !profile.public)) {
            // Not own profile and not public
            return res.status(404).send({
              message: errorHandler.getErrorMessageByKey('not-found')
            });
          } else {
            // Transform profile into object so that we can add new fields to it
            done(err, profile);
          }
        });
    },

    // Sanitize & return profile
    function(profile, done) {
      req.profile = exports.sanitizeProfile(profile, req.user);
      return done(null, profile);
    },

    // Read User's reply statistics and add them to req.profile
    // We need to add it to req.profile, because profile is mongoose object and
    // adding properties to it doesn't work
    function(profile, done) {
      // find the statistics
      messageStatService.readFormattedMessageStatsOfUser(profile._id, Date.now(),
        function (err, stats) {

          // If we receive error, let's just continue.
          // The stats are non-essential.
          if (!err) {
            // add replyRate and replyTime to req.profile
            _.assign(req.profile, _.pick(stats, ['replyRate', 'replyTime']));
          }

          return done();
        });
    },

    // Next Route
    function () {
      next();
    }

  ], function(err) {
    if (err) return next(err);
  });

};


/**
 * Sanitize profile before sending it to frontend
 * - Ensures certain fields are removed before publishing
 * - Collects tribe and tag id's into one simple array
 * - Removes tag and tribe references that don't exist anymore (i.e. they are removed from `tags` table but reference ID remains in the user's table)
 * - Sanitize description in case
 */
exports.sanitizeProfile = function(profile, authenticatedUser) {
  if (!profile) {
    console.warn('sanitizeProfile() needs profile data to sanitize.');
    return;
  }

  profile = profile.toObject();

  // We're sanitizing this already on saving/updating the profile, but here we do it again just in case.
  if (profile.description) profile.description = sanitizeHtml(profile.description, textProcessor.sanitizeOptions);

  // Remove tribes/tags without reference object (= they've been deleted from tags table)
  if (profile.member && profile.member.length > 0) {
    profile.member = _.reject(profile.member, function(o) { return !o.tag; });
  }

  // Create simple arrays of tag and tribe id's
  profile.memberIds = [];
  if (profile.member && profile.member.length > 0) {
    profile.member.forEach(function(obj) {
      // If profile's `member.tag` path was populated
      if (obj.tag && obj.tag._id) {
        profile.memberIds.push(obj.tag._id.toString());
      } else if (obj.tag) {
        // If profile's `member.tag` path wasn't populated, tag is ObjectId
        profile.memberIds.push(obj.tag.toString());
      }
    });
  }

  // Profile does not belong to currently authenticated user
  // Remove data we don't need from other member's profile
  if (!authenticatedUser || !authenticatedUser._id.equals(profile._id)) {
    delete profile.updated;
  }

  // This info totally shouldn't be at the frontend
  //
  // - They're not included on `exports.userProfileFields`,
  //   but this is an additional layer of security
  //
  // - This step is required by `core.server.controller.js `
  //   as it would otherwise send authenticated user's profile "as is"
  delete profile.resetPasswordToken;
  delete profile.resetPasswordExpires;
  delete profile.emailToken;
  delete profile.password;
  delete profile.salt;

  // This information is not sensitive, but isn't needed at frontend
  delete profile.publicReminderCount;
  delete profile.publicReminderSent;

  return profile;
};

/**
 * Join tribe or tag
 */
exports.modifyUserTag = function(req, res) {

  // Relation (`is`|`likes`|`leave`) should be present
  if (!req.body.relation || typeof req.body.relation !== 'string' || ['is', 'likes', 'leave'].indexOf(req.body.relation) === -1) {
    return res.status(400).send({
      message: 'Missing relation info.'
    });
  }

  // Not a valid ObjectId
  if (!req.body.id || !mongoose.Types.ObjectId.isValid(req.body.id)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Joining [is/likes] (=true) or leaving (=false)?
  // Relation can be "join" or "leave"
  var joining = (req.body.relation !== 'leave');

  async.waterfall([

    // Check user is a member of this tag/tribe
    function(done) {

      // Search for existing occurance with provided tag/tribe id
      var isMember = (req.user.member && req.user.member.length) ? _.find(req.user.member, function(membership) {
        return membership.tag.equals(req.body.id);
      }) : false;

      // Return error if "is joining + is a member" OR "is leaving + isn't a member"
      if ((isMember && joining) || (!isMember && !joining)) {
        return res.status(409).send({
          message: errorHandler.getErrorMessageByKey('conflict')
        });
      } else {
        done(null);
      }
    },

    // Update tribe/tag counter
    function(done) {
      Tag.findByIdAndUpdate(req.body.id, {
        $inc: {
          count: (joining ? 1 : -1)
        }
      }, {
        safe: false, // @link http://stackoverflow.com/a/4975054/1984644
        new: true // get the updated document in return
      })
      .exec(function(err, tag) {

        // Tag by id `req.body.id` didn't exist
        if (!tag || !tag._id) {
          return res.status(400).send({
            message: errorHandler.getErrorMessageByKey('bad-request')
          });
        }

        done(err, tag);
      });
    },

    // Add tribe/tag to user's object
    function(tag, done) {

      // Mongo query to perform...
      var query;
      if (joining) {
        // When joining...
        query = {
          $push: {
            member: {
              tag: tag._id,
              relation: req.body.relation,
              since: Date.now()
            }
          }
        };
      } else {
        // When leaving...
        query = {
          $pull: {
            member: {
              tag: tag._id
            }
          }
        };
      }

      User.findByIdAndUpdate(req.user._id, query, {
        safe: true, // @link http://stackoverflow.com/a/4975054/1984644
        new: true // get the updated document in return
      })
      .exec(function(err, user) {
        done(err, tag, user);
      });
    },

    // Done, output new tribe/tag + user objects
    function(tag, user, done) {

      // Preserver only public fields
      // Array of keys to preserve in tag/tribe before sending it to the frontend
      var pickFields = tag.tribe ? tribesHandler.tribeFields.split(' ') : tagsHandler.tagFields.split(' ');
      var pickedTag = _.pick(tag, pickFields);

      // Sanitize user profile
      user = exports.sanitizeProfile(user, req.user);

      var message = '';
      message += (joining ? 'Joined' : 'Left');
      message += ' ' + ((tag && tag.tribe) ? 'tribe' : 'tag') + '.';

      statService.stat({
        namespace: 'tagAction',
        counts: {
          count: joining ? 1 : -1
        },
        tags: {
          type: tag.tribe ? 'tribe' : 'tag'
        },
        meta: {
          slug: tag.slug
        }
      }, function() {

        // Send response to API
        res.send({
          message: message,
          tag: pickedTag,
          user: user
        });

        done();

      });
    }

  // Catch errors
  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: 'Failed to join tribe/tag.'
      });
    }
  });

};

/**
 * Get user's tags and tribes
 */
exports.getUserMemberships = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  if (req.params.type && (req.params.type !== 'tribe' && req.params.type !== 'tag')) {
    return res.status(400).send({
      message: 'Type can be only either `tribe` or `tag`.'
    });
  }

  User
    .findById(req.user._id, 'member')
    .populate({
      path: 'member.tag',
      select: tagsHandler.tagFields + ' ' + tribesHandler.tribeFields,
      model: 'Tag'
      // Not possible at the moment due bug in Mongoose
      // http://mongoosejs.com/docs/faq.html#populate_sort_order
      // https://github.com/Automattic/mongoose/issues/2202
      // options: { sort: { count: -1 } }
    })
    .exec(function(err, profile) {

      // Something went wrong
      if (err) {
        return res.status(400).send({
          message: 'Failed to get list of tags and/or tribes.'
        });
      }

      var memberships = profile.member || [];

      // Only tags or tribes?
      if (req.params.type && memberships.length) {
        var tribeOrTag = req.params.type === 'tribe';
        memberships = _.filter(memberships, { 'tag': { 'tribe': tribeOrTag } });
      }

      return res.send(memberships);
    });
};

exports.removePushRegistration = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  var user = req.user;
  var token = req.params.token;

  var query = {
    $pull: {
      pushRegistration: {
        token: token
      }
    }
  };

  User.findByIdAndUpdate(user._id, query, {
    safe: true, // @link http://stackoverflow.com/a/4975054/1984644
    new: true // get the updated document in return
  })
  .exec(function(err, user) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err) || 'Failed to remove registration, please try again.'
      });
    } else {
      return res.send({
        message: 'Removed registration.',
        user: user
      });
    }
  });

};

/**
 * Add push registration
 */
exports.addPushRegistration = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  var user = req.user;
  var token = req.body.token;
  var platform = req.body.platform;

  async.waterfall([

    // Remove any existing registrations for this token

    function(done) {
      User.findByIdAndUpdate(user._id, {
        $pull: {
          pushRegistration: {
            token: token
          }
        }
      }).exec(function(err) {
        done(err);
      });

    },

    // Add new registration

    function(done) {
      User.findByIdAndUpdate(user._id, {
        $push: {
          pushRegistration: {
            platform: platform,
            token: token,
            created: Date.now()
          }
        }
      }, {
        new: true
      }).exec(function(err, updatedUser) {
        if (err) return done(err);
        user = updatedUser;
        done();
      });
    },

    // Notify the user we just added a device

    function(done) {
      pushService.notifyPushDeviceAdded(user, platform, function(err) {
        if (err) console.error(err); // don't stop on error
        done();
      });
    }

  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err) || 'Failed, please try again.'
      });
    } else {
      User.findById(user._id).exec(function(err, user) {
        if (err) {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err) || 'Failed to fetch user, please try again.'
          });
        }
        return res.send({
          message: 'Saved registration.',
          user: user
        });
      });
    }
  });

};

/**
 * Get invitation code
 */
exports.getInviteCode = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  return res.send({
    code: inviteCodeService.getCode()
  });
};

/**
 * Validate invitation code
 */
exports.validateInviteCode = function(req, res) {

  var inviteCode = req.params.invitecode;

  return res.send({
    valid: inviteCode && inviteCodeService.validateCode(inviteCode.toLowerCase())
  });
};
