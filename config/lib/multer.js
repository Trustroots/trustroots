'use strict';

/**
 * Valid mime types
 */
module.exports.validMimeTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif'];

/**
 * Filter Multer uploads based on mime Type
 * Note: A proper magic byte check is still required after this
 */
module.exports.uploadFileFilter = function (req, file, callback) {
  if (module.exports.validMimeTypes.indexOf(file.mimetype) === -1) {
    var err = new Error('Please upload only png, jpg or gif images.');
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    return callback(err, false);
  }
  callback(null, true);
};
