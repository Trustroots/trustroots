// External dependencies
const multer = require('multer');
const os = require('os');
const path = require('path');

// Internal dependencies
const config = require(path.resolve('./config/config'));
const errorService = require(path.resolve('./modules/core/server/services/error.server.service'));

/**
 * Valid image file mime types
 */
module.exports.validImageMimeTypes = [
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

/**
 *
 * @param {Array} validMimeTypes - List of mime types filter should accept
 * @param {String} uploadField - Name of the POST upload field in the form
 * @param {Object} req - Express.js middleware request
 * @param {Object} res - Express.js middleware response
 * @param {Function} next — Next middleware function
 */
module.exports.uploadFileFilter = (validMimeTypes, uploadField, req, res, next) => {
  // Create Multer instance
  // - Destination folder will default to `os.tmpdir()` if no configuration path available
  // - Destination filename will default to 16 bytes of
  //   random data as a hex-string (e.g. a087fda2cf19f341ddaeacacab285acc)
  //   without file-extension.
  const upload = multer({
    dest: config.uploadTmpDir || os.tmpdir(),
    limits: {
      fileSize: config.maxUploadSize // max file size in bytes
    },
    /**
     * Filter Multer uploads based on mime Type
     * Note: A proper "magic byte" check is still required after this
     */
    fileFilter: (req, file, callback) => {
      if (validMimeTypes.indexOf(file.mimetype) === -1) {
        const err = new Error('Please upload a file that is in correct format.');
        err.code = 'UNSUPPORTED_MEDIA_TYPE';
        return callback(err, false);
      }
      callback(null, true);
    }
  }).single(uploadField);

  upload(req, res, (err) => {
    // An error occurred when uploading
    // See Multer default error codes:
    // @link https://github.com/expressjs/multer/blob/805170c61530e1f1cafd818c9b63d16a9dd46c36/lib/multer-error.js
    if (err) {
      let errorMessage;
      let errorStatus;

      // This error code is generated from Multer's fileFilter above
      if (err.code && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        // Unsupported media type -error
        errorMessage = errorService.getErrorMessageByKey('unsupported-media-type');
        errorStatus = 415;
      } else if (err.code && err.code === 'LIMIT_FILE_SIZE') {
        // Too big file
        const maxUploadSizeMb = (config.maxUploadSize / (1024 * 1024)).toFixed(2);
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
        message: errorMessage
      });
    }

    // Everything went fine, call next middleware
    next();
  });
};
