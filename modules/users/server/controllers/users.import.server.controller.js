const path = require('path');
const errorService = require(path.resolve('./modules/core/server/services/error.server.service'));
const fileUpload = require(path.resolve('./modules/core/server/services/file-upload.service'));

// log = require(path.resolve('./config/lib/logger')),

/**
 * Middleware to validate+process avatar upload field
 */
exports.csImportUploadField = function (req, res, next) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  fileUpload.uploadFile(['application/zip'], 'import-file', req, res, next);
};
