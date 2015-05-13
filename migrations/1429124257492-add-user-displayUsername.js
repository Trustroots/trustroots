'use strict';

/**
 * Updates model with displayUsername field
 */

 var config = require(path.resolve('./config/config')),
     configMongoose = require(path.resolve('./config/lib/mongoose')),
     configExpress = require(path.resolve('./config/lib/express')),
     path = require('path'),
     mongoose = require('mongoose'),
     userModels = require(path.resolve('./modules/users/server/models/user.server.model')),
     User = mongoose.model('User');

exports.up = function(next) {
    User.find({ displayUsername: {$exists: false} }).forEach(
        function (elem) {
            User.update(
                {},
                { $set: { displayUsername: elem.username } },
                { multi: true }
            );
        }
    );
    next();
};

exports.down = function(next) {
      User.update(
          { displayUsername: { $exists: true } },
          { '$unset': { displayUsername: "" } },
          { multi: true }
      );
    next();
};
