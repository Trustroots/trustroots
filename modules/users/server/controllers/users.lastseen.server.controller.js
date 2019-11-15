/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    moment = require('moment'),
    path = require('path'),
    User = mongoose.model('User'),
    config = require(path.resolve('config/config'));

/**
 * When user is logged in, update her last seen to Now in database
 */
module.exports = function (req, res, next) {
  // is user logged in?
  if (req.user) {
    // has enough time passed since the last update?
    var expectedTimeToPass = moment.duration(config.limits.timeToUpdateLastSeenUser).asMilliseconds();
    var isTimePassed = !req.user.seen || Date.now() - req.user.seen.getTime() > expectedTimeToPass;
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
