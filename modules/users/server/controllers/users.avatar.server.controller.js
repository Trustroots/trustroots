const _ = require('lodash');
const async = require('async');
const fs = require('fs');
const mkdirRecursive = require('mkdir-recursive');
const mongoose = require('mongoose');
const path = require('path');

const log = require(path.resolve('./config/lib/logger'));
const config = require(path.resolve('./config/config'));
const fileUpload = require(path.resolve(
  './modules/core/server/services/file-upload.service',
));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

const User = mongoose.model('User');

// Load either ImageMagick or GraphicsMagick as an image processor
// Defaults to GraphicsMagick
// @link https://github.com/aheckmann/gm#use-imagemagick-instead-of-gm
const imageProcessor =
  config.imageProcessor === 'imagemagic'
    ? require('gm').subClass({ imageMagick: true })
    : require('gm');

/**
 * Middleware to validate+process avatar upload field
 */
const avatarUploadField = (req, res, next) => {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  const validImageMimeTypes = [
    'image/gif',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  fileUpload.uploadFile(validImageMimeTypes, 'avatar', req, res, next);
};

/**
 * Upload user avatar
 *
 * Handles results from avatarUploadField and `uploadFile` service.
 * Multer has placed uploaded the file in temp folder and path is now available
 * via `req.file.path`
 */
const avatarUpload = (req, res) => {
  // Each user has their own folder for avatars
  const uploadDir =
    path.resolve(config.uploadDir) + '/' + req.user._id + '/avatar'; // No trailing slash

  /**
   * Process uploaded file
   */
  async.waterfall(
    [
      // Ensure user's upload directory exists
      function (done) {
        mkdirRecursive.mkdir(uploadDir, function (err) {
          if (err && err.code !== 'EEXIST') {
            return done(err);
          }
          done();
        });
      },

      // Make the thumbnails
      function (done) {
        let asyncQueueErrorHappened;

        // Create a queue worker
        // @link https://github.com/caolan/async#queueworker-concurrency
        const q = async.queue(function (thumbSize, callback) {
          // Create thumbnail size
          // Images are resized following quality/size -optimization tips from this article:
          // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/
          imageProcessor(req.file.path)
            // .in('jpeg:fancy-upsampling=false')  // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#resampling
            .autoOrient()
            .noProfile() // No color profile
            .colorspace('rgb') // Not sRGB @link https://ehc.ac/p/graphicsmagick/bugs/331/?limit=25
            .interlace('None') // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#progressive-rendering
            .filter('Triangle') // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#resampling
            .resize(thumbSize, thumbSize + '^') // ^ = Dimensions are treated as minimum rather than maximum values. @link http://www.graphicsmagick.org/Magick++/Geometry.html
            .gravity('Center')
            .extent(thumbSize, thumbSize)
            .unsharp(0.25, 0.25, 8, 0.065) // radius [, sigma, amount, threshold] - @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#sharpening
            .quality(82) // @link https://www.smashingmagazine.com/2015/06/efficient-image-resizing-with-imagemagick/#quality-and-compression
            .write(uploadDir + '/' + thumbSize + '.jpg', function (err) {
              // Something's wrong with the file, stop here.
              if (err) {
                log(
                  'error',
                  'User profile avatar upload: failed to generate thumbnail.',
                  err,
                );

                // This stops us sending res multiple times since tasks are running paraller
                if (!asyncQueueErrorHappened) {
                  asyncQueueErrorHappened = true;

                  // Stop the queue
                  q.pause();

                  // Attempt to delete tmp file
                  fs.unlink(req.file.path, function (err) {
                    if (err) {
                      log(
                        'error',
                        'User profile avatar upload: failed to clean out temporary image.',
                        err,
                      );
                    }
                    // @link http://www.restpatterns.org/HTTP_Status_Codes/422_-_Unprocessable_Entity
                    return res.status(422).send({
                      message: 'Failed to process image, please try again.',
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
      function (done) {
        fs.unlink(req.file.path, function (err) {
          done(err);
        });
      },

      // Catch errors
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message:
            errorService.getErrorMessage(err) ||
            'Failed to process image, please try again.',
        });
      } else {
        // All Done!
        return res.send({
          message: 'Avatar image uploaded.',
        });
      }
    },
  );
};

/**
 * Generate avatar url from facebook
 * @link https://developers.facebook.com/docs/graph-api/reference/user/picture/
 * @param {object} user - user object
 * @param {string} user.additionalProvidersData.facebook.id - user's facebook id
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function getFacebookAvatarUrl(user, size) {
  const id = _.get(user, ['additionalProvidersData', 'facebook', 'id'], false);

  return (
    id &&
    `https://graph.facebook.com/${id}/picture/?width=${size}&height=${size}`
  );
}

/**
 * Generate url to avatar image that user uploaded
 * @param {object} user - user object
 * @param {number} size - size of the image
 * @returns {string} - the url
 */
function getLocalAvatarUrl(user, size) {
  const isValid = user && user.avatarUploaded && user._id;

  if (isValid) {
    // Cache buster
    const timestamp = user.updated ? new Date(user.updated).getTime() : '';

    // 32 is the smallest and 2048 biggest file size we're generating.
    const fileSize = Math.min(Math.max(size, 32), 2048);

    const domain = `${config.https ? 'https' : 'http'}://${config.domain}`;

    return `${domain}/uploads-profile/${user._id}/avatar/${fileSize}.jpg?${timestamp}`;
  }
}

/**
 * Generate avatar url from Gravatar
 * @link https://en.gravatar.com/site/implement/images/
 * @param {object} user - user object
 * @param {string} user.emailHash - gravatar identifies users by their email hashes
 * @param {number} size - size of the image
 * @returns {string} - the url
 *
 * @todo fallback image is provided from trustroots.org; it should rather come from config
 */
function getGravatarUrl(user, size) {
  const isValid = user.emailHash;

  // This fallback image has to be online one and not from localhost, since Gravatar needs to see it.
  const fallbackImage = getDefaultAvatarUrl(size, false);

  return (
    isValid &&
    `https://gravatar.com/avatar/${
      user.emailHash
    }?s=${size}&d=${encodeURIComponent(fallbackImage)}`
  );
}

/**
 * Generate avatar url
 * @param {object} user - user object
 * @param {integer} size - size of the image. Supported values are 2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16.
 * @param {string} source - avatar source. One of ['' (user's selected source), 'none', 'facebook', 'gravatar', 'local']
 * @returns {string} - the url
 */
function getAvatarUrl(profile, size, source) {
  return (
    (source === 'local' && getLocalAvatarUrl(profile, size)) ||
    (source === 'gravatar' && getGravatarUrl(profile, size)) ||
    (source === 'facebook' && getFacebookAvatarUrl(profile, size)) ||
    getDefaultAvatarUrl(size)
  );
}

function getDefaultAvatarUrl(size = 1024, local = true) {
  const domain = local
    ? `${config.https ? 'https' : 'http'}://${config.domain}`
    : 'https://trustroots.org';

  return `${domain}/img/avatar-${size}.png`;
}

/**
 * Serve avatar URL via redirect
 *
 * @TODO: serve by streaming instead of redirect and add caching layer.
 *
 * @param  {Object} res
 * @param  {String} url
 */
function serveAvatarUrl(res, url) {
  res
    .status(302) // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302
    // .setHeader('Cache-Control', 'public, max-age=0')
    .redirect(url);
}

/**
 * Return avatar file URL
 */
const getAvatar = (req, res) => {
  const validSizes = [2048, 1024, 512, 256, 128, 64, 36, 32, 24, 16];
  const defaultSize = 1024;

  if (req.query.size && !validSizes.includes(parseInt(req.query.size, 10))) {
    return res.status(400).send({
      message: `Invalid size. Please use one of these: ${validSizes.join(
        ', ',
      )}`,
    });
  }

  const size = parseInt(req.query.size, 10) || defaultSize;
  const defaultAvatarUrl = getDefaultAvatarUrl(size);

  if (!req.profile) {
    return serveAvatarUrl(res, defaultAvatarUrl);
  }

  const isOwnProfile = req.user._id.equals(req.profile._id);
  const isBannedProfile =
    req.profile.roles.includes('suspended') ||
    req.profile.roles.includes('shadowban');
  const isPublicProfile = req.profile.public;
  const isAdminOrModerator =
    req.user.roles.includes('moderator') || req.user.roles.includes('admin');

  if (
    !isAdminOrModerator &&
    !isOwnProfile &&
    (!isPublicProfile || isBannedProfile)
  ) {
    return serveAvatarUrl(res, defaultAvatarUrl);
  }

  let source = req.profile.avatarSource;

  // Only authenticated user can define custom source
  if (req.query.source && isOwnProfile) {
    const validSources = User.schema.path('avatarSource').enumValues;

    if (!validSources.includes(req.query.source)) {
      return res.status(400).send({
        message: `Invalid source. Please use one of these: ${validSources.join(
          ', ',
        )}`,
      });
    }
    source = req.query.source;
  }

  const avatarUrl = getAvatarUrl(req.profile, size, source);

  serveAvatarUrl(res, avatarUrl);
};

/**
 * Middleware to find user for avatar
 */
const userForAvatarByUserId = async (req, res, next, userId) => {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  const fields = [
    'additionalProvidersData.facebook.id', // For FB avatars
    'avatarSource',
    'avatarUploaded',
    'emailHash', // MD5 hashed email to use with Gravatars
    'id',
    'public',
    'roles',
    'updated',
  ].join(' ');

  // We could limit search here to only public and non-suspended users, but that's more complex and slower query.
  req.profile = await User.findById(userId, fields);

  next();
};

module.exports = {
  avatarUpload,
  avatarUploadField,
  getAvatar,
  userForAvatarByUserId,
};
