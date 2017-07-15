'use strict';

var Expo = require('exponent-server-sdk');

// to check if something is a push token
exports.isPushToken = Expo.isExponentPushToken;

// create a new Expo SDK client
var expo = new Expo();

// send push notification (returns Promise)
exports.sendToDevice = function sendToDevice(tokens, notification) {

  // Promises for each token to push to
  var pushPromises = [];

  // iterate over tokens
  tokens.forEach(function(token) {
    // dispatch push notification and save returned Promise
    pushPromises.push(expo.sendPushNotificationsAsync([{
      // Exponent target device token
      to: token,
      // text to display
      body: notification.body || '',
      // action URL
      data: { url: notification.click_action }
    }]));
  });

  // return unified Promise
  // (resolves when all push actions succeeded, rejects if any of them fails)
  return Promise.all(pushPromises);
};
