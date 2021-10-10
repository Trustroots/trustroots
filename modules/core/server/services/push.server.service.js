const _ = require('lodash');
const path = require('path');
const agenda = require(path.resolve('./config/lib/agenda'));
const config = require(path.resolve('./config/config'));
const url = (config.https ? 'https' : 'http') + '://' + config.domain;
const analyticsHandler = require(path.resolve(
  './modules/core/server/controllers/analytics.server.controller',
));

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
    body:
      'You just enabled Trustroots ' +
      platformVerbal(platform) +
      ' notifications. Yay!',
    click_action: analyticsHandler.appendUTMParams(editAccountUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'device-added',
      content: 'reply-to',
    }),
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
    body,
    click_action: analyticsHandler.appendUTMParams(messagesUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'messages-unread',
      content: 'reply-to',
    }),
  };

  exports.sendUserNotification(userTo, notification, callback);
};

/**
 * Send a push notification about a new experience, to the receiver of the experience
 * @param {User} userFrom - user who gave the experience
 * @param {User} userTo - user who received the experience
 * @param {Object} data - notification config
 */
exports.notifyNewExperienceFirst = function (userFrom, userTo, callback) {
  const giveExperienceUrl = `${url}/profile/${userFrom.username}/experiences/new`;

  const notification = {
    title: 'Trustroots',
    body: `${userFrom.displayName} shared their experience with you. Share your experience, too.`,
    click_action: analyticsHandler.appendUTMParams(giveExperienceUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'new-experience',
      content: 'respond',
    }),
  };
  exports.sendUserNotification(userTo, notification, callback);
};

/**
 * Send a push notification about a new experience, to the receiver of the experience
 * @param {User} userFrom - user who gave the experience
 * @param {User} userTo - user who received the experience
 * @param {string} experienceId - ID of the experience
 */
exports.notifyNewExperienceSecond = function (
  userFrom,
  userTo,
  experienceId,
  callback,
) {
  const readExperiencesUrl = `${url}/profile/${userTo.username}/experiences#${experienceId}`;

  const notification = {
    title: 'Trustroots',
    body: `${userFrom.displayName} shared their experience with you. Both experiences are now published.`,
    click_action: analyticsHandler.appendUTMParams(readExperiencesUrl, {
      source: 'push-notification',
      medium: 'fcm',
      campaign: 'new-experience',
      content: 'read',
    }),
  };
  exports.sendUserNotification(userTo, notification, callback);
};

exports.sendUserNotification = function (user, notification, callback) {
  const data = {
    userId: user._id,
    pushServices: user.pushRegistration,
    notification,
  };

  agenda.now('send push message', data, callback);
};
