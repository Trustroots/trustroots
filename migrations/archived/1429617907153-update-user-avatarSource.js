/**
 * Replaces "locale" with "local" from User.avatarSource
 */

const path = require('path');
const mongooseService = require(path.resolve('./config/lib/mongoose'));
const chalk = require('chalk');
const mongoose = require('mongoose');
// eslint-disable-next-line no-unused-vars
const userModels = require(path.resolve('./modules/users/server/models/user.server.model'));
const User = mongoose.model('User');

exports.up = function (next) {

  mongooseService.connect(function () {
    console.log(chalk.green('Connected to MongoDB.'));
    User.update(
      { avatarSource: 'locale' },
      { avatarSource: 'local' },
      { multi: true },
      function (err, numberAffected) {
        if (err) {
          console.log(chalk.red(err));
          mongoose.disconnect();
          return;
        }
        console.log('Affected rows:');
        console.log(numberAffected);
        console.log('');
        mongooseService.disconnect(function () {
          next();
        });
      });
  });
};

exports.down = function (next) {
  mongooseService.connect(function () {
    console.log(chalk.green('Connected to MongoDB.'));
    User.update(
      { avatarSource: 'local' },
      { avatarSource: 'locale' },
      { multi: true },
      function (err, numberAffected) {
        if (err) {
          console.log(chalk.red(err));
          mongoose.disconnect();
          return;
        }
        console.log('Affected rows:');
        console.log(numberAffected);
        console.log('');
        mongooseService.disconnect(function () {
          next();
        });
      });
  });
};
