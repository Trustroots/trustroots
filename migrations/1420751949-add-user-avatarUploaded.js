'use strict';

/*
 * Add avatarUploaded for user model
 * Determines if avatars exist at users upload folder
 */

 var init = require('../config/init')(),
     config = require('../config/config'),
     mongoose = require('mongoose'),
     models = require('../app/models/user'),
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
