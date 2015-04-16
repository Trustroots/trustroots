'use strict';

/**
 * Updates model with displayUsername field
 */

var init = require('../config/init')(),
    config = require('../config/config'),
    mongoose = require('mongoose'),
    models = require('../app/models/user'),
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


