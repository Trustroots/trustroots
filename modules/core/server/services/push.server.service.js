'use strict';

var _ = require('lodash'),
    path = require('path'),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller'));

exports.notifyPushDeviceAdded = function(user, platform, callback) {

  if (_.get(user, 'pushRegistration', []).length === 0) return callback();

  var editAccountUrl = url + '/profile/edit/account';

  var notification = {
    title: 'Trustroots',
    body: 'You just enabled Trustroots ' + platform.replace('expo', 'mobile') + ' push notifications. Yay!',
    click_action: analyticsHandler.appendUTMParams(editAccountUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'device-added',
      content: 'reply-to'
    })
  };

  exports.sendUserNotification(user, notification, callback);
};

exports.notifyMessagesUnread = function(userFrom, userTo, data, callback) {

  if (_.get(userTo, 'pushRegistration', []).length === 0) return callback();

  var messageCount = data.messages.length;

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

exports.sendUserNotification = function(user, notification, callback) {

  var data = {
    userId: user._id,
    pushServices: user.pushRegistration,
    notification: notification
  };

  agenda.now('send push message', data, callback);

};
