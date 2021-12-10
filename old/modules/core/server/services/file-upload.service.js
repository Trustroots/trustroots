// External dependencies
const multer = require('multer');
const os = require('os');
const path = require('path');
const mmmagic = require('mmmagic');

// Internal dependencies
const config = require(path.resolve('./config/config'));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

/**
 * Upload file handler and validator using Multer and Mmmagic.
 * Places the file in a temp folder
 *
 * @link https://github.com/expressjs/multer
 * @link https://www.npmjs.com/package/mmmagic
 *
 * @param {Array} validMimeTypes - List of mime types filter should accept
 * @param {String} uploadField - Name of the POST upload field in the multipart-form
 * @param {Object} req - Express.js middleware request
 * @param {Object} res - Express.js middleware response
 * @param {Function} next — Next middleware function
 */
module.exports.uploadFile = (validMimeTypes, uploadField, req, res, next) => {
  // Create Multer instance
  // - Destination folder will default to `os.tmpdir()` if no configuration path available
  // - Destination filename will default to 16 bytes of
  //   random data as a hex-string (e.g. a087fda2cf19f341ddaeacacab285acc)
  //   without file-extension.
  const upload = multer({
    dest: config.uploadTmpDir || os.tmpdir(),
    limits: {
      fileSize: config.maxUploadSize, // max file size in bytes
    },
    // Filter Multer uploads based on mime Type
    // Note: A proper "magic byte" check is still required after this
    fileFilter: (req, file, callback) => {
      if (!file.mimetype || !validMimeTypes.includes(file.mimetype)) {
        const err = new Error(
          'Please upload a file that is in correct format.',
        );
        err.code = 'UNSUPPORTED_MEDIA_TYPE';
        return callback(err, false);
      }
      callback(null, true);
    },
  }).single(uploadField);

  upload(req, res, err => {
    // An error occurred when uploading
    // See Multer default error codes:
    // @link https://github.com/expressjs/multer/blob/805170c61530e1f1cafd818c9b63d16a9dd46c36/lib/multer-error.js
    if (err) {
      let errorMessage;
      let errorStatus;

      // This error code is generated from Multer's fileFilter above
      if (err.code && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        // Unsupported media type -error
        errorMessage = errorService.getErrorMessageByKey(
          'unsupported-media-type',
        );
        errorStatus = 415;
      } else if (err.code && err.code === 'LIMIT_FILE_SIZE') {
        // Too big file
        const maxUploadSizeMb = (config.maxUploadSize / (1024 * 1024)).toFixed(
          2,
        );
        errorMessage = `Image too big. Please maximum ${maxUploadSizeMb} Mb files.`;
        errorStatus = 413; // 413: "Request Entity Too Large"
      } else if (err.code && err.code === 'LIMIT_UNEXPECTED_FILE') {
        // Field doesn't exist -error
        errorMessage = `Missing "${uploadField}" field from the API call.`;
        errorStatus = 400;
      } else {
        // Any other error
        errorMessage = errorService.getErrorMessageByKey('default');
        errorStatus = 400;
      }

      return res.status(errorStatus).send({
        message: errorMessage,
      });
    }

    // `req.file` is placed there by Multer
    // See `users.server.routes.js` for more details.
    if (!req.file || !req.file.path) {
      return res.status(422).send({
        message: errorService.getErrorMessageByKey('unprocessable-entity'),
      });
    }

    // Validate uploaded file using libmagic
    // This is stronger and more secure than lightweight mime check that Multer does
    // The check is performed with "magic bytes"
    // @link https://www.npmjs.com/package/mmmagic
    const Magic = mmmagic.Magic;
    const magic = new Magic(mmmagic.MAGIC_MIME_TYPE);
    magic.detectFile(req.file.path, (err, result) => {
      if (err || (result && !validMimeTypes.includes(result))) {
        return res.status(415).send({
          message: errorService.getErrorMessageByKey('unsupported-media-type'),
        });
      }

      // Everything went fine, call next middleware than can then handle the
      // file onwards from temp folder
      next();
    });
  });
};
