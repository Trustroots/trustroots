const path = require('path');
const async = require('async');
const firebaseMessaging = require(path.resolve(
  './config/lib/firebase-messaging',
));
const exponentNotifications = require(path.resolve(
  './config/lib/exponent-notifications',
));
const mongoose = require('mongoose');
const User = mongoose.model('User');
const log = require(path.resolve('./config/lib/logger'));

const UNREGISTERED_TOKEN_ERROR_CODE =
  'messaging/registration-token-not-registered';

module.exports = function (job, done) {
  const attrs = job.attrs;
  const data = attrs.data;

  // Get job id from Agenda job attributes
  // Agenda stores Mongo `ObjectId` so turning that into a string here
  const jobId = attrs._id.toString();

  const userId = data.userId;
  const pushServices = data.pushServices;
  const notification = data.notification;

  // Log that we're sending a notification
  log('debug', 'Starting `send push notification` job', { jobId });

  // Validate notification
  if (!notification.body || !notification.click_action) {
    log(
      'error',
      '`send push notification` job cannot send notification due missing required `body` or `click_action` values #zqo8bf',
      {
        jobId,
      },
    );

    // Don't return error, as we're not going to let Agenda attempt this job again
    return done();
  }

  // tokens for Firebase and Exponent
  const firebaseTokens = [];
  const exponentTokens = [];

  // Sort push tokens by cloud service
  pushServices.forEach(function (pushService) {
    switch (String(pushService.platform)) {
      case 'ios':
      case 'android':
      case 'web':
        // tokens with platforms 'web', 'android' and 'ios' belong to Firebase
        firebaseTokens.push(pushService.token);
        break;
      case 'expo':
        exponentTokens.push(pushService.token);
        break;
      default:
        log(
          'error',
          'The `send push notification` job cannot process notification due missing platform value. #f932hf',
          {
            jobId,
          },
        );
    }
  });

  // push to Firebase
  const firebasePushPromise = new Promise(function (resolve, reject) {
    // any Firebase tokens to push to?
    if (firebaseTokens.length === 0) {
      log(
        'debug',
        '`send push notification` job could not find Firebase tokens.',
        { jobId },
      );
      // if not, mark as done
      resolve();
      return;
    }
    // push to Firebase
    firebaseMessaging
      .sendToDevice(firebaseTokens, { notification })
      .then(function (response) {
        const unregisteredTokens = [];
        response.results.forEach(function (result, idx) {
          if (result.error) {
            if (result.error.code === UNREGISTERED_TOKEN_ERROR_CODE) {
              unregisteredTokens.push(firebaseTokens[idx]);
            }
          }
        });
        if (unregisteredTokens.length > 0) {
          removeUserPushTokens(userId, unregisteredTokens, function (error) {
            (error && reject(error)) || resolve();
          });
        } else {
          resolve();
        }
      })
      .catch(function (err) {
        reject(err);
      });
  });

  // push to Exponent
  const exponentPushPromise = exponentNotifications.sendToDevice(
    exponentTokens,
    notification,
  );

  // Wait for all push services to finish
  // `Promise.all` is rejected if any of the elements are rejected:
  // Thus we use `async.reflect()`, which wraps the async function in another
  // function that always completes with a result object, even when it errors.
  Promise.all([
    async.reflect(firebasePushPromise),
    async.reflect(exponentPushPromise),
  ])
    .then(function () {
      process.nextTick(function () {
        log('info', 'Successfully finished `send push message` job', {
          jobId,
        });
        return done();
      });
    })
    .catch(function (err) {
      process.nextTick(function () {
        log('error', 'The `send push notification` job failed', {
          jobId,
          error: err,
        });
        return done(new Error('Failed to send push message.'));
      });
    });
};

function removeUserPushTokens(userId, tokens, callback) {
  if (!tokens || tokens.length === 0) {
    return callback();
  }

  const query = {
    $pull: {
      pushRegistration: {
        token: {
          $in: tokens,
        },
      },
    },
  };

  User.findByIdAndUpdate(userId, query).exec(function (err) {
    if (err) {
      log(
        'error',
        'The `send push notification` job failed to remove invalid tokens from user. #gj932f',
        {
          err,
        },
      );
    }
    callback(err);
  });
}
