'use strict';

/*
 * Add avatarUploaded for user model
 * Determines if avatars exist at users upload folder
 */

 var config = require(path.resolve('./config/config')),
     configMongoose = require(path.resolve('./config/lib/mongoose')),
     configExpress = require(path.resolve('./config/lib/express')),
     path = require('path'),
     mongoose = require('mongoose'),
     userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
     User = mongoose.model('User');

exports.up = function(next) {
  User.update(
    { avatarUploaded: { $exists: false } },
    { '$set': { avatarUploaded: false } },
    { multi: true },
    next
  );
};

exports.down = function(next) {
  User.update(
    { avatarUploaded: { $exists: true } },
    { '$unset': { avatarUploaded: "" } },
    { multi: true },
    next
  );
};
