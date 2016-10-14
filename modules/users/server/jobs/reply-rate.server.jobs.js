'use strict';

var path = require('path'),
    replyRateController =
  require(path.resolve('./modules/users/server/controllers/user-reply-rate.server.controller')),
    updateUserReplyRate = replyRateController.updateUserReplyRate,
    updateExpiredReplyRates = replyRateController.updateExpiredReplyRates;

exports.updateUser = function (job, done) {
  var data = job.attrs.data;
  var userId = data.userId;

  updateUserReplyRate(userId, function (err) {
    if (err) {
      return done(err);
    }
    return done();
  });
};

exports.updateExpiredUsers = function (job, done) {
  updateExpiredReplyRates(function (err) {
    if (err) {
      return done(err);
    }
    return done();
  });
};
