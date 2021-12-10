/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const moment = require('moment');
const path = require('path');
const User = mongoose.model('User');
const config = require(path.resolve('config/config'));

/**
 * When user is logged in, update her last seen to Now in database
 */
module.exports = function (req, res, next) {
  // is user logged in?
  if (req.user) {
    // has enough time passed since the last update?
    const expectedTimeToPass = moment
      .duration(config.limits.timeToUpdateLastSeenUser)
      .asMilliseconds();
    const isTimePassed =
      !req.user.seen ||
      Date.now() - req.user.seen.getTime() > expectedTimeToPass;
    if (isTimePassed) {
      // update the User.seen to Now
      User.findByIdAndUpdate(req.user.id, { seen: new Date() }, function (err) {
        return next(err);
      });
    } else {
      return next();
    }
  } else {
    return next();
  }
};
