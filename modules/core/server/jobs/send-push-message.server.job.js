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
  var pushServices = data.pushServices;
  var notification = data.notification;

  // Log that we're sending a notification
  log('debug', 'Starting `send push notification` job', { jobId: jobId });

  // tokens for Firebase and Exponent
  var firebaseTokens = [],
      exponentTokens = [];

  // sort push tokens by cloud service
  pushServices.forEach(function(pushService) {
    if (pushService.platform === 'expo') {
      exponentTokens.push(pushService.token);
    } else {
      // tokens with platforms 'web', 'android' and 'ios' belong to Firebase
      firebaseTokens.push(pushService.token);
    }
  });

  // push to Firebase
  var firebasePushPromise = new Promise(function(resolve, reject) {
    // any Firebase tokens to push to?
    if (!firebaseTokens) {
      // if not, mark as done
      resolve();
      return;
    }
    // push to Firebase
    firebaseMessaging.sendToDevice(firebaseTokens, { notification: notification })
      .then(function(response) {
        var unregisteredTokens = [];
        response.results.forEach(function(result, idx) {
          if (result.error) {
            if (result.error.code === UNREGISTERED_TOKEN_ERROR_CODE) {
              unregisteredTokens.push(firebaseTokens[idx]);
            }
          }
        });
        if (unregisteredTokens.length > 0) {
          removeUserPushTokens(userId, unregisteredTokens, function(error) {
            error && reject(error) || resolve();
          });
        } else {
          resolve();
        }
      })
      .catch(function() { reject(); });
  });

  // wait for push service to finish
  firebasePushPromise
    .then(function() {
      process.nextTick(function() {
        log('info', 'Successfully finished `send push message` job', {
          jobId: jobId
        });
        return done();
      });
    })
    .catch(function(err) {
      process.nextTick(function() {
        log('error', 'The `send push notification` job failed', {
          jobId: jobId,
          error: err
        });
        return done(new Error('Failed to send push message.'));
      });
    });
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
