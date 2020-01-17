/**
 * Updates model with displayUsername field
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
    try {
      // Works fine for small db, but for bigger use snapshot()
      // http://docs.mongodb.org/manual/reference/method/cursor.snapshot/
      User
        .find({ displayUsername: { $exists: false } }, function (err, users) {
          users.forEach(function (e) {
            User.findByIdAndUpdate(
              e._id,
              { $set: { displayUsername: e.username } },
            ).exec();
          });
          mongooseService.disconnect(function () {
            next();
          });
        });
    } catch (err) {
      console.log(chalk.red(err));
      mongooseService.disconnect(function () {
        next();
      });
    }
  });
};

exports.down = function (next) {
  mongooseService.connect(function () {
    console.log(chalk.green('Connected to MongoDB.'));
    User.update(
      { displayUsername: { $exists: true } },
      { '$unset': { displayUsername: '' } },
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
