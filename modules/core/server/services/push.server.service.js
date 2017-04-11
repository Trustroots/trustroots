var _ = require('lodash'),
    path = require('path'),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller'));

exports.notifyMessagesUnread = function(userFrom, userTo, data, callback) {

  console.log('PUSH', userTo, userTo.pushRegistration, data);

  if (_.get(userTo, 'pushRegistration', []).length === 0) return callback();

  var messageCount = data.messages.length;

  var body;

  if (messageCount > 1) {
    body = 'You have ' + messageCount + ' unread messages';
  } else {
    body = 'You have one unread message';
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

  var tokens = _.get(user, 'pushRegistration', []).map(function(reg) {
    return reg.token;
  });

  var data = {
    userId: user._id,
    tokens: tokens,
    payload: {
      notification: notification
    }
  };

  agenda.now('send push message', data, callback);

};
