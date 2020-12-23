const Expo = require('expo-server-sdk');
const log = require('./logger');

// to check if something is a push token
exports.isPushToken = Expo.isExponentPushToken;

// create a new Expo SDK client
const expo = new Expo();

// send push notification (returns Promise)
exports.sendToDevice = function sendToDevice(tokens, notification) {
  // The Expo push notification service accepts batches of notifications so
  // that we don't need to send 1000 requests to send 1000 notifications.
  // This array is a batch of notifications to reduce the number of requests
  // and to compress them (notifications with similar content will get
  // compressed).
  const notifications = [];

  // iterate over tokens
  tokens.forEach(function (token) {
    if (!token || !Expo.isExpoPushToken(token)) {
      log('error', 'Invalid or missing Expo push notification token #mg9hwf', {
        token,
      });
      return;
    }

    // Construct a message
    // @link https://docs.expo.io/versions/latest/guides/push-notifications.html#message-format
    notifications.push({
      /**
       * An Expo push token specifying the recipient of this message.
       */
      to: token,

      /**
       * A sound to play when the recipient receives this notification. Specify
       * "default" to play the device's default notification sound, or omit this
       * field to play no sound.
       */
      sound: 'default',

      /**
       * The delivery priority of the message. Specify "default" or omit this field
       * to use the default priority on each platform, which is "normal" on Android
       * and "high" on iOS.
       *
       * On Android, normal-priority messages won't open network connections on
       * sleeping devices and their delivery may be delayed to conserve the battery.
       * High-priority messages are delivered immediately if possible and may wake
       * sleeping devices to open network connections, consuming energy.
       *
       * On iOS, normal-priority messages are sent at a time that takes into account
       * power considerations for the device, and may be grouped and delivered in
       * bursts. They are throttled and may not be delivered by Apple. High-priority
       * messages are sent immediately. Normal priority corresponds to APNs priority
       * level 5 and high priority to 10.
       */
      priority: 'high',

      /**
       * The title to display in the notification. On iOS this is displayed only
       * on Apple Watch.
       */
      title: notification.title || notification.body || '',

      /**
       * The message to display in the notification
       */
      body: notification.body || '',

      /**
       * A JSON object delivered to your app. It may be up to about 4KiB; the total
       * notification payload sent to Apple and Google must be at most 4KiB or else
       * you will get a "Message Too Big" error.
       */
      data: {
        // Action URL
        url: notification.click_action,
      },
    });
  });

  // No valid notifications left, just return
  if (notifications.length === 0) {
    return Promise.resolve();
  }

  // There is a limit on the number of push notifications you can send at once.
  // `chunkPushNotifications` divides an array of push notification messages
  // into appropriately sized chunks.
  const chunks = expo.chunkPushNotifications(notifications);

  const promises = [];

  chunks.forEach(function (chunk) {
    promises.push(expo.sendPushNotificationsAsync(chunk));
  });

  // return unified Promise
  // (resolves when all push actions succeeded, rejects if any of them fails)
  return Promise.resolve(promises);
};
