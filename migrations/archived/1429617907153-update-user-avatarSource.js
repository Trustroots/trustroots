/**
 * Replaces "locale" with "local" from User.avatarSource
 */

var path = require('path'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    chalk = require('chalk'),
    mongoose = require('mongoose'),
    // eslint-disable-next-line no-unused-vars
    userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
    User = mongoose.model('User');

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
