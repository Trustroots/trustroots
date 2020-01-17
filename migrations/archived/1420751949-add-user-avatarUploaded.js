/**
 * Add avatarUploaded for user model
 * Determines if avatars exist at users upload folder
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
      { avatarUploaded: { $exists: false } },
      { '$set': { avatarUploaded: false } },
      { multi: true },
    ).exec(function (err, numberAffected) {
      if (err) {
        console.log(chalk.red(err));
      } else {
        console.log('Affected rows:');
        console.log(numberAffected);
        console.log('');
      }
      mongooseService.disconnect(function () {
        next(err);
      });
    });
  });
};

exports.down = function (next) {
  mongooseService.connect(function () {
    console.log(chalk.green('Connected to MongoDB.'));
    User.update(
      { avatarUploaded: { $exists: true } },
      { '$unset': { avatarUploaded: '' } },
      { multi: true },
    ).exec(function (err, numberAffected) {
      if (err) {
        console.log(chalk.red(err));
      } else {
        console.log('Affected rows:');
        console.log(numberAffected);
        console.log('');
      }
      mongooseService.disconnect(function () {
        next(err);
      });
    });
  });
};
