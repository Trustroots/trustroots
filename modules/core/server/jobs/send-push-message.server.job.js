'use strict';

var path = require('path'),
    firebaseMessaging = require(path.resolve('./config/lib/firebase-messaging')),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    log = require(path.resolve('./config/lib/logger'));

var UNREGISTERED_TOKEN_ERROR_CODE = 'messaging/registration-token-not-registered';

module.exports = function(job, done) {

  var attrs = job.attrs;
  var data = attrs.data;

  // Get job id from Agenda job attributes
  // Agenda stores Mongo `ObjectId` so turning that into a string here
  var jobId = attrs._id.toString();

  var userId = data.userId;
  var tokens = data.tokens;
  var payload = data.payload;

  // Log that we're sending an email
  log('debug', 'Starting `send push notification` job', { jobId: jobId });

  firebaseMessaging.sendToDevice(tokens, payload)
    .then(function(response) {
      var unregisteredTokens = [];
      response.results.forEach(function(result, idx) {
        if (result.error) {
          if (result.error.code === UNREGISTERED_TOKEN_ERROR_CODE) {
            unregisteredTokens.push(tokens[idx]);
          }
        }
      });
      if (unregisteredTokens.length > 0) {
        removeUserPushTokens(userId, unregisteredTokens, onFinish);
      } else {
        onFinish();
      }
    }).catch(onFinish);

  function onFinish(err) {
    process.nextTick(function() {
      if (err) {
        log('error', 'The `send push notification` job failed', {
          jobId: jobId,
          error: err
        });
        return done(new Error('Failed to send push message.'));
      } else {
        log('info', 'Successfully finished `send push message` job', {
          jobId: jobId
        });
        return done();
      }
    });
  }

};

function removeUserPushTokens(userId, tokens, callback) {
  if (!tokens || tokens.length === 0) return callback();

  var query = {
    $pull: {
      pushRegistration: {
        token: {
          $in: tokens
        }
      }
    }
  };

  User.findByIdAndUpdate(userId, query).exec(function(err) {
    if (err) console.error('error removing tokens', err);
    callback(err);
  });

}
