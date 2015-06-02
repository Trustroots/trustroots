'use strict';

/*
 * Add avatarUploaded for user model
 * Determines if avatars exist at users upload folder
 */

 var config = require(path.resolve('./config/config')),
     configMongoose = require(path.resolve('./config/lib/mongoose')),
     configExpress = require(path.resolve('./config/lib/express')),
     path = require('path'),
     chalk = require('chalk'),
     mongoose = require('mongoose'),
     userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
     User = mongoose.model('User');

exports.up = function(next) {
  mongoose.connect(config.db.uri, config.db.options, function(err) {
    if (err) {
      console.log(chalk.red(err));
      mongoose.disconnect();
      return;
    }
    User.update(
      { avatarUploaded: { $exists: false } },
      { '$set': { avatarUploaded: false } },
      { multi: true }
    ).exec(function (err, numberAffected, raw) {
      if (err) {
        console.log(chalk.red(err));
        mongoose.disconnect();
        return;
      }
      console.log('Affected rows:');
      console.log(numberAffected);
      console.log('');
      mongoose.disconnect();
      next();
    });
  });
};

exports.down = function(next) {
  mongoose.connect(config.db.uri, config.db.options, function(err) {
    if (err) {
      console.log(chalk.red(err));
      mongoose.disconnect();
      return;
    }
    User.update(
      { avatarUploaded: { $exists: true } },
      { '$unset': { avatarUploaded: "" } },
      { multi: true }
    ).exec(function (err, numberAffected, raw) {
      if (err) {
        console.log(chalk.red(err));
        mongoose.disconnect();
        return;
      }
      console.log('Affected rows:');
      console.log(numberAffected);
      console.log('');
      mongoose.disconnect();
      next();
    });
  });
};
