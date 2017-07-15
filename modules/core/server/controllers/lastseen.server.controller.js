var mongoose = require('mongoose'),
    User = mongoose.model('User');

/**
 * When user is logged in, update her last seen to Now in database
 */
module.exports = function (req, res, next) {
  if (req.user) {
    // update the User.seen to Now
    User.findByIdAndUpdate(req.user.id, { seen: new Date() }, function (err) {
      return next(err);
    });
  } else {
    return next();
  }

};
