'use strict';

/**
 * Updates model with displayUsername field
 */

var init = require('../config/init')(),
    config = require('../config/config'),
    mongoose = require('mongoose'),
    chalk = require('chalk'),
    userModel = require('../app/models/user'),
    User = mongoose.model('User');

exports.up = function(next) {
  var db = mongoose.connect(config.db.uri, config.db.options, function(err) {
    if (err) {
      console.log(chalk.red(err));
      mongoose.disconnect();
      return;
    }
    try {
      // Works fine for small db, but for bigger use snapshot()
      // http://docs.mongodb.org/manual/reference/method/cursor.snapshot/
      User
        .find({ displayUsername: {$exists: false} }, function(err, users){
        users.forEach(function (e) {

          User.findByIdAndUpdate(
            e._id,
            { $set: { displayUsername: e.username } }
          ).exec();
        });
        mongoose.disconnect();
        next();
        });
    }
    catch(err) {
      console.log(chalk.red(err));
      mongoose.disconnect();
      next();
    }
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
      { displayUsername: { $exists: true } },
      { '$unset': { displayUsername: "" } },
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
