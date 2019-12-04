const _ = require('lodash');
const path = require('path');
const agenda = require(path.resolve('./config/lib/agenda'));
const config = require(path.resolve('./config/config'));
const url = (config.https ? 'https' : 'http') + '://' + config.domain;
const analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller'));

exports.notifyPushDeviceAdded = function (user, platform, callback) {

  if (_.get(user, 'pushRegistration', []).length === 0) return callback();

  const editAccountUrl = url + '/profile/edit/account';

  function platformVerbal(platform) {
    switch (platform) {
      case 'web':
        return 'desktop';
      case 'expo':
        return 'mobile';
      case 'ios':
        return 'mobile';
      case 'android':
        return 'mobile';
      default:
        return platform;
    }
  }

  const notification = {
    title: 'Trustroots',
    body: 'You just enabled Trustroots ' + platformVerbal(platform) + ' notifications. Yay!',
    click_action: analyticsHandler.appendUTMParams(editAccountUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'device-added',
      content: 'reply-to'
    })
  };

  exports.sendUserNotification(user, notification, callback);
};

exports.notifyMessagesUnread = function (userFrom, userTo, data, callback) {

  // User does not have push registrations
  if (_.get(userTo, 'pushRegistration', []).length === 0) {
    return callback();
  }

  const messageCount = _.get(data, 'messages', []).length;

  // Is the notification the first one?
  // If not, we send a different message.
  const isFirst = !(data.notificationCount > 0);

  let body;

  if (isFirst) {
    // First notification
    if (messageCount > 1) {
      body = 'You have ' + messageCount + ' unread messages';
    } else {
      body = 'You have one unread message';
    }
  } else {
    // Second notification
    body = userFrom.displayName + ' is still waiting for a reply';
  }

  const messagesUrl = url + '/messages';

  const notification = {
    title: 'Trustroots',
    body: body,
    click_action: analyticsHandler.appendUTMParams(messagesUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'messages-unread',
      content: 'reply-to'
    })
  };

  exports.sendUserNotification(userTo, notification, callback);
};

/**
 * Send a push notification about a new reference, to the receiver of the reference
 * @param {User} userFrom - user who gave the reference
 * @param {User} userTo - user who received the reference
 * @param {Object} data - notification config
 * @param {boolean} data.isFirst - is it the first reference between users?
 */
exports.notifyNewReference = function (userFrom, userTo, data, callback) {
  const giveReferenceUrl = url + '/profile/' + userFrom.username + '/references/new';
  const readReferencesUrl = url + '/profile/' + userTo.username + '/references';

  // When the reference is first, reply reference can be given.
  // Otherwise both references are public now and can be seen.
  const actionText = (data.isFirst) ? 'Give a reference back.' : 'You can see it.';
  const actionUrl = (data.isFirst) ? giveReferenceUrl : readReferencesUrl;

  const notification = {
    title: 'Trustroots',
    body: userFrom.username + ' gave you a new reference. ' + actionText,
    click_action: analyticsHandler.appendUTMParams(actionUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'new-reference',
      content: 'reply-to' // @TODO what are the correct parameters here? What do they mean?
    })
  };
  exports.sendUserNotification(userTo, notification, callback);
};

exports.sendUserNotification = function (user, notification, callback) {

  const data = {
    userId: user._id,
    pushServices: user.pushRegistration,
    notification: notification
  };

  agenda.now('send push message', data, callback);

};
