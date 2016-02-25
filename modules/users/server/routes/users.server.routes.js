'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    multer = require('multer'),
    os = require('os'),
    config = require(path.resolve('./config/config')),
    usersPolicy = require('../policies/users.server.policy'),
    users = require('../controllers/users.server.controller'),
    uploadFileFilter = require(path.resolve('./config/lib/multer')).uploadFileFilter;

/**
 * Create Multer instance
 * - Destination folder will default to `os.tmpdir()` if no configuration path available
 * - Destination filename will default to 16 bytes of
 *   random data as a hex-string (e.g. a087fda2cf19f341ddaeacacab285acc)
 *   without file-extension.
 */
var upload = multer({
      dest: config.uploadTmpDir || os.tmpdir(),
      limits: {
        fileSize: config.maxUploadSize // max file size in bytes
      },
      fileFilter: uploadFileFilter
    });

module.exports = function(app) {

  // Setting up the users profile api
  app.route('/api/users').all(usersPolicy.isAllowed)
    .put(users.update);

  app.route('/api/users-avatar').all(usersPolicy.isAllowed)
    .post(upload.single('avatar'), users.avatarUpload);

  app.route('/api/users/mini/:userId').all(usersPolicy.isAllowed)
    .get(users.getMiniUser);

  app.route('/api/users/accounts/:provider').delete(users.removeOAuthProvider);

  app.route('/api/users/password').post(users.changePassword);

  app.route('/api/users/:username').all(usersPolicy.isAllowed)
    .get(users.getUser);

  // Finish by binding the user middleware
  app.param('userId', users.userMiniByID);
  app.param('username', users.userByUsername);
};
