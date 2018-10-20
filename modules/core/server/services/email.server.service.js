'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    async = require('async'),
    juice = require('juice'),
    moment = require('moment'),
    autolinker = require('autolinker'),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    textService = require(path.resolve('./modules/core/server/services/text.server.service')),
    render = require(path.resolve('./config/lib/render')),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain;

exports.sendMessagesUnread = function (userFrom, userTo, notification, callback) {

  // Is the notification the first one?
  // If not, we send a different subject.
  var isFirst = !(notification.notificationCount > 0);

  // Generate mail subject
  var mailSubject = (isFirst)
    ? userFrom.displayName + ' wrote you from Trustroots'
    : userFrom.displayName + ' is still waiting for a reply on Trustroots';

  // URLs to use at email templates
  var urlUserFromProfile = url + '/profile/' + userFrom.username,
      urlReply = url + '/messages/' + userFrom.username,
      campaign = 'messages-unread';

  // Variables passed to email text/html templates
  var params = exports.addEmailBaseTemplateParams({
    subject: mailSubject,
    name: userTo.displayName,
    email: userTo.email,
    mailTitle: mailSubject,
    messageCount: notification.messages.length,
    messages: notification.messages,
    userFromName: userFrom.displayName,
    userToName: userTo.displayName,
    urlReplyPlainText: urlReply,
    urlReply: analyticsHandler.appendUTMParams(urlReply, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign,
      content: 'reply-to'
    }),
    urlUserFromProfilePlainText: urlUserFromProfile,
    urlUserFromProfile: analyticsHandler.appendUTMParams(urlUserFromProfile, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign,
      content: 'profile'
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('messages-unread', params, callback);
};

exports.sendConfirmContact = function (user, friend, contact, messageHTML, messageText, callback) {
  var meURL = url + '/profile/' + user.username,
      urlConfirm = url + '/contact-confirm/' + contact._id,
      campaign = 'confirm-contact';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm contact',
    name: friend.displayName,
    email: friend.email,
    messageHTML: messageHTML,
    messageText: messageText,
    meName: user.displayName,
    meURLPlainText: meURL,
    meURL: analyticsHandler.appendUTMParams(meURL, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign,
      content: 'profile'
    }),
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign,
      content: 'confirm-contact'
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('confirm-contact', params, callback);
};

/**
 * Email with a token to initialize removing a user
 */
exports.sendRemoveProfile = function (user, callback) {
  var urlConfirm = url + '/remove/' + user.removeProfileToken,
      campaign = 'remove-profile';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm removing your Trustroots profile',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    })
  });
  exports.renderEmailAndSend('remove-profile', params, callback);
};

/**
 * Email confirmation that user was removed
 */
exports.sendRemoveProfileConfirmed = function (user, callback) {
  var campaign = 'remove-profile-confirmed';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Your Trustroots profile has been removed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });
  exports.renderEmailAndSend('remove-profile-confirmed', params, callback);
};

exports.sendResetPassword = function (user, callback) {
  var urlConfirm = url + '/api/auth/reset/' + user.resetPasswordToken,
      campaign = 'reset-password';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Password Reset',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    })
  });
  exports.renderEmailAndSend('reset-password', params, callback);
};

exports.sendResetPasswordConfirm = function (user, callback) {

  var urlResetPassword = url + '/password/forgot',
      campaign = 'reset-password-confirm';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Your password has been changed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlResetPasswordPlainText: urlResetPassword,
    urlResetPassword: analyticsHandler.appendUTMParams(urlResetPassword, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    })
  });
  exports.renderEmailAndSend('reset-password-confirm', params, callback);
};

exports.sendChangeEmailConfirmation = function (user, callback) {

  var urlConfirm = url + '/confirm-email/' + user.emailToken,
      campaign = 'confirm-email';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm email change',
    name: user.displayName,
    email: user.emailTemporary,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('email-confirmation', params, callback);
};

exports.sendSignupEmailConfirmation = function (user, callback) {

  var urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true',
      campaign = 'confirm-email';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm Email',
    name: user.displayName,
    email: user.emailTemporary || user.email,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('signup', params, callback);
};

exports.sendSupportRequest = function (replyTo, supportRequest, callback) {

  var params = {
    from: 'Trustroots Support <' + config.supportEmail + '>',
    name: 'Trustroots Support', // `To:`
    email: config.supportEmail, // `To:`
    replyTo: replyTo,
    subject: 'Support request',
    request: supportRequest,
    skipHtmlTemplate: true, // Don't render html template for this email
    sparkpostCampaign: 'support-request'
  };

  exports.renderEmailAndSend('support-request', params, callback);
};

exports.sendSignupEmailReminder = function (user, callback) {

  var urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true',
      campaign = 'signup-reminder';

  // This email is a reminder number `n` to this user
  // Set to `1` (first) if the field doesn't exist yet
  // `publicReminderCount` contains number of reminders already sent to user
  var reminderCount = user.publicReminderCount ? user.publicReminderCount + 1 : 1;

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Complete your signup to Trustroots',
    name: user.displayName,
    email: user.emailTemporary || user.email,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: campaign
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    reminderCount: reminderCount, // This email is a reminder number `n` to this user
    reminderCountMax: config.limits.maxSignupReminders, // Max n of reminders system sends
    timeAgo: moment(user.created).fromNow() // A string, e.g. `3 days ago`
  });

  // This will be the last reminder, mention that at the email subject line
  if ((user.publicReminderCount + 1) === config.limits.maxSignupReminders) {
    params.subject = 'Last change to complete your signup to Trustroots!';
  }

  exports.renderEmailAndSend('signup-reminder', params, callback);
};

exports.sendReactivateHosts = function (user, callback) {
  var urlOffer = url + '/offer',
      campaign = 'reactivate-hosts',
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: user.firstName + ', start hosting on Trustroots again?',
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlOfferPlainText: urlOffer,
    urlOffer: analyticsHandler.appendUTMParams(urlOffer, utmParams),
    urlSurveyPlainText: config.surveyReactivateHosts || false,
    urlSurvey: config.surveyReactivateHosts ? analyticsHandler.appendUTMParams(config.surveyReactivateHosts, utmParams) : false,
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('reactivate-hosts', params, callback);
};

/**
 * 1/3 welcome sequence email
 */
exports.sendWelcomeSequenceFirst = function (user, callback) {
  var urlEditProfile = url + '/profile/edit',
      urlFAQ = url + '/faq',
      campaign = 'welcome-sequence-first',
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: '👋 Welcome to Trustroots ' + user.firstName + '!',
    from: {
      name: 'Natalia',
      // Use support email instead of default "no-reply@":
      address: config.supportEmail
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlFAQ: analyticsHandler.appendUTMParams(urlFAQ, utmParams),
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('welcome-sequence-first', params, callback);
};

/**
 * 2/3 welcome sequence email
 */
exports.sendWelcomeSequenceSecond = function (user, callback) {
  var urlMeet = url + '/offer/meet',
      campaign = 'welcome-sequence-second',
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Meet new people at Trustroots, ' + user.firstName,
    from: {
      name: 'Kasper',
      // Use support email instead of default "no-reply@":
      address: config.supportEmail
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlMeetup: analyticsHandler.appendUTMParams(urlMeet, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('welcome-sequence-second', params, callback);
};

/**
 * 3/3 welcome sequence email
 */
exports.sendWelcomeSequenceThird = function (user, callback) {

  // For members with empty profiles,
  // remind them how important it is to fill their profile.
  // Ask for feedback from the rest.
  var descriptionLength = textService.plainText(user.description || '', true).length;
  var messageTopic = (descriptionLength < config.profileMinimumLength) ? 'fill-profile' : 'feedback';

  var urlEditProfile = url + '/profile/edit',
      campaign = 'welcome-sequence-third' + '-' + messageTopic,
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: 'How is it going, ' + user.firstName + '?',
    from: {
      name: 'Mikael',
      // Use support email instead of default "no-reply@":
      address: config.supportEmail
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    topic: messageTopic
  });

  exports.renderEmailAndSend('welcome-sequence-third', params, callback);
};

/**
 * Reference Notification (First between users)
 */
exports.sendReferenceNotificationFirst = function (userFrom, userTo, callback) {

  var params = exports.addEmailBaseTemplateParams({
    subject: 'New reference from ' + userFrom.username,
    email: userTo.email,
    giveReferenceUrl: url + '/profile/' + userFrom.username + '/references/new'
  });

  exports.renderEmailAndSend('reference-notification-first', params, callback);
};

/**
 * Reference Notification (Second reference between users)
 */
exports.sendReferenceNotificationSecond = function (userFrom, userTo, reference, callback) {

  var params = exports.addEmailBaseTemplateParams({
    subject: 'New reference from ' + userFrom.username,
    email: userTo.email,
    seeReferencesUrl: url + '/profile/' + userTo.username + '/references',
    recommend: reference.recommend
  });

  exports.renderEmailAndSend('reference-notification-second', params, callback);
};

/**
 * Add several parameters to be used to render transactional emails
 * These variables are used by email base template:
 * `modules/core/server/views/email-templates/email.server.view.html`
 *
 * @param {Object[]} params - Parameters used for rendering emails
 * @returns {Object[]} - Returns object with supportUrl, footerUrl and headerUrl parameters.
 */
exports.addEmailBaseTemplateParams = function (params) {
  if (params === null || typeof params !== 'object') {
    console.error('addEmailBaseTemplateParams: requires param to be Object. No URL parameters added.');
    return {};
  }

  var baseUrl = (config.https ? 'https' : 'http') + '://' + config.domain;

  params.urlSupportPlainText = baseUrl + '/support';
  params.footerUrlPlainText = baseUrl;

  params.headerUrl = analyticsHandler.appendUTMParams(baseUrl, {
    source: 'transactional-email',
    medium: 'email',
    campaign: params.utmCampaign || 'transactional-email',
    content: 'email-header'
  });

  params.footerUrl = analyticsHandler.appendUTMParams(baseUrl, {
    source: 'transactional-email',
    medium: 'email',
    campaign: params.utmCampaign || 'transactional-email',
    content: 'email-footer'
  });

  params.supportUrl = analyticsHandler.appendUTMParams(params.urlSupportPlainText, {
    source: 'transactional-email',
    medium: 'email',
    campaign: params.utmCampaign || 'transactional-email',
    content: 'email-support'
  });

  return params;
};

exports.renderEmail = function (templateName, params, callback) {

  var templatePaths = {};

  // `./modules/core/server/views/email-templates-text`
  templatePaths.text = path.join('email-templates-text', templateName + '.server.view.html');

  if (!params.skipHtmlTemplate) {
    // `./modules/core/server/views/email-templates`
    templatePaths.html = path.join('email-templates', templateName + '.server.view.html');
  }

  // Rendering in parallel leads to an error. maybe because
  // swig is unmaintained now https://github.com/paularmstrong/swig)
  async.mapValuesSeries(templatePaths, function (templatePath, key, done) {
    render(templatePath, params, function (err, rendered) {

      // there are promises inside render(), need to execute callback in
      // nextTick() so callback can safely throw exceptions
      // see https://github.com/caolan/async/issues/1150
      async.nextTick(function () {
        done(err, rendered);
      });

    });
  }, function (err, result) {
    if (err) return callback(err);

    // Clean out html entities (like &gt;) from plain text emails
    result.text = textService.plainText(result.text);

    // Wrap links with `<` and `>` from plain text emails
    result.text = autolinker.link(result.text, {
      urls: true,
      email: false,
      phone: false,
      mention: false,
      hashtag: false,
      stripPrefix: false,
      replaceFn: function (match) {
        return '<' + match.getAnchorHref() + '>';
      }
    });

    var email = {
      to: {
        name: params.name,
        address: params.email
      },
      from: params.from || 'Trustroots <' + config.mailer.from + '>',
      subject: params.subject,
      text: result.text
    };
    if (result.html) {
      // Inline CSS with Juice
      email.html = juice(result.html);
    }
    if (params.replyTo) {
      email.replyTo = params.replyTo;
    }
    // Add SparkPost `campaign_id` to headers if available
    // @link https://developers.sparkpost.com/api/smtp-api.html
    if (params.sparkpostCampaign) {
      email.headers = {
        'X-MSYS-API': {
          'campaign_id': params.sparkpostCampaign
        }
      };
    }
    callback(null, email);
  });
};

exports.renderEmailAndSend = function (templateName, params, callback) {
  exports.renderEmail(templateName, params, function (err, email) {
    if (err) return callback(err);
    agenda.now('send email', email, callback);
  });
};
