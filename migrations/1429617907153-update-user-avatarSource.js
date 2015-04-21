'use strict';

/**
 * Replaces "locale" with "local" from User.avatarSource
 */

var init = require('../config/init')(),
    config = require('../config/config'),
    mongoose = require('mongoose'),
    chalk = require('chalk'),
    userModel = require('../app/models/user'),
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
