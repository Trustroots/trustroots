'use strict';

module.exports.uploadFileFilter = function (req, file, cb) {
  if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/gif') {
    return cb(new Error('Plase upload only png, jpg or gif images.'), false);
  }
  cb(null, true);
};
