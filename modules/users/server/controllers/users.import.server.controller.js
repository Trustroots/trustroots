// const fs = require('fs');
const path = require('path');
const errorService = require(path.resolve('./modules/core/server/services/error.server.service'));
const fileUpload = require(path.resolve('./modules/core/server/services/file-upload.service'));
const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');

// log = require(path.resolve('./config/lib/logger')),

/**
 * Middleware to validate+process import file upload field
 */
exports.csImportUploadField = (req, res, next) => {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  fileUpload.uploadFile(['application/zip'], 'import-file', req, res, next);
};

/**
 *
 */
exports.processCsImport = async (req, res) => {

  // eslint-disable-next-line
  console.log(req.file.path);

  try {
    // @TODO: Need to have some good destination folder here
    await decompress(req.file.path, './tmp/unzipped', {
      plugins: [
        decompressUnzip()
      ]
    });
  } catch (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err)
    });
  }

  // fs.unlink(req.file.path);
  res.send({
    message: 'Import file processed.'
  });
};
