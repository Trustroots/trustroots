'use strict';

/**
 * Replaces "locale" with "local" from User.avatarSource
 */

 var path = require('path'),
     config = require(path.resolve('./config/config')),
     configMongoose = require(path.resolve('./config/lib/mongoose')),
     configExpress = require(path.resolve('./config/lib/express')),
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
      { avatarSource: 'locale' },
      { avatarSource: 'local' },
      { multi: true },
      function (err, numberAffected, raw) {
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
      { avatarSource: 'local' },
      { avatarSource: 'locale' },
      { multi: true },
      function (err, numberAffected, raw) {
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
