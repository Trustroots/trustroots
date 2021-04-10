/**
 * This is used to send Facebook notifications for users who have connected
 * the app to their Facebook accounts.
 *
 * Read more:
 * @link https://developers.facebook.com/docs/games/services/appnotifications
 * @link https://developers.facebook.com/docs/graph-api/reference/user/notifications
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const async = require('async');
const analyticsHandler = require(path.resolve(
  './modules/core/server/controllers/analytics.server.controller',
));
const config = require(path.resolve('./config/config'));
const render = require(path.resolve('./config/lib/render'));
const agenda = require(path.resolve('./config/lib/agenda'));

exports.notifyMessagesUnread = function (
  userFrom,
  userTo,
  notification,
  callback,
) {
  // Lodash works better with native objects rather than Mongo objects
  userFrom = userFrom.toObject();
  userTo = userTo.toObject();

  if (!exports.canNotifyUser(userTo)) {
    return callback(null);
  }

  // Variables passed to Facebook notification template
  const params = {
    // Count used for template rendering
    messageCount: notification.messages.length,

    // FB id used to target Facebook notification
    toUserFacebookId: _.get(userTo, 'additionalProvidersData.facebook.id'),

    // FB id of user who wrote the message (defaults to `false`)
    fromUserFacebookId: _.get(
      userFrom,
      'additionalProvidersData.facebook.id',
      false,
    ),

    // Will be appended after the FB Canvas app URL
    // i.e. don't include "https://www..." here!
    // Including `iframe_getaway=true` at URL will cause page to jump out from
    // Facebook canvas iframe. Leaving it out or to `false` will leave page
    // inside canvas when FB notification is clicked.
    // See `/modules/core/client/app/init.js` for more.
    href: analyticsHandler.appendUTMParams(
      'messages/' + userFrom.username + '?iframe_getaway=true',
      {
        source: 'facebook-notification',
        medium: 'facebook',
        campaign: 'messages-unread',
        content: 'reply-to',
      },
    ),
  };

  // Use different templates for 1st and 2nd notification
  const nth = !(notification.notificationCount > 0) ? 'first' : 'second';

  exports.renderNotificationAndSend('messages-unread-' + nth, params, callback);
};

/**
 * Are Facebook notifications enabled?
 */
exports.isNotificationsEnabled = function () {
  return (
    _.has(config, 'facebook.clientID') &&
    _.has(config, 'facebook.clientSecret') &&
    _.get(config, 'facebook.notificationsEnabled')
  );
};

/**
 * Can user be notified via Facebook?
 * Requires Facebook connection to be present with `id` and `accessToken` params
 */
exports.canNotifyUser = function (user) {
  return (
    _.has(user, 'additionalProvidersData.facebook.id') &&
    _.has(user, 'additionalProvidersData.facebook.accessToken')
  );
};

exports.renderNotification = function (templateName, params, callback) {
  const templatePath = path.resolve(
    './modules/core/server/views/facebook-notifications/' +
      templateName +
      '.server.view.html',
  );

  render(templatePath, params, function (err, renderedTemplate) {
    if (err) return callback(err);

    // Remove white space
    renderedTemplate = renderedTemplate.trim();

    // The Graph API accepts a maximum of 180 characters in the message field,
    // and will truncate messages after 120 characters.
    // https://developers.facebook.com/docs/games/services/appnotifications#templating
    if (renderedTemplate.length > 180) {
      renderedTemplate = renderedTemplate.substr(0, 179).trim() + '…';
    }

    // there are promises inside render(), need to execute callback in
    // nextTick() so callback can safely throw exceptions
    // see https://github.com/caolan/async/issues/1150
    async.nextTick(function () {
      if (err) return callback(err);

      // Params passed on for the Agenda job
      const notification = params;

      // Notification message rendered from template and params
      notification.template = renderedTemplate;

      callback(null, notification);
    });
  });
};

exports.renderNotificationAndSend = function (templateName, params, callback) {
  exports.renderNotification(
    templateName,
    params,
    function (err, notification) {
      if (err) return callback(err);
      // Add to Agenda queue
      agenda.now('send facebook notification', notification, callback);
    },
  );
};
