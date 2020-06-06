const async = require('async');
const path = require('path');
const fs = require('fs');
const mkdirRecursive = require('mkdir-recursive');

const log = require(path.resolve('./config/lib/logger'));
const config = require(path.resolve('./config/config'));
const fileUpload = require(path.resolve(
  './modules/core/server/services/file-upload.service',
));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

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
exports.avatarUploadField = function (req, res, next) {
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
exports.avatarUpload = function (req, res) {
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
