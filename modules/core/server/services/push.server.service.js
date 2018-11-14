'use strict';

var _ = require('lodash'),
    path = require('path'),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller'));

exports.notifyPushDeviceAdded = function (user, platform, callback) {

  if (_.get(user, 'pushRegistration', []).length === 0) return callback();

  var editAccountUrl = url + '/profile/edit/account';

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

  var notification = {
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

  var messageCount = _.get(data, 'messages', []).length;

  // Is the notification the first one?
  // If not, we send a different message.
  var isFirst = !(data.notificationCount > 0);

  var body;

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

  var messagesUrl = url + '/messages';

  var notification = {
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
  var giveReferenceUrl = url + '/profile/' + userFrom.username + '/references/new';
  var readReferencesUrl = url + '/profile/' + userTo.username + '/references';

  // When the reference is first, reply reference can be given.
  // Otherwise both references are public now and can be seen.
  var actionText = (data.isFirst) ? 'Give a reference back.' : 'You can see it.';
  var actionUrl = (data.isFirst) ? giveReferenceUrl : readReferencesUrl;

  var notification = {
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

  var data = {
    userId: user._id,
    pushServices: user.pushRegistration,
    notification: notification
  };

  agenda.now('send push message', data, callback);

};
