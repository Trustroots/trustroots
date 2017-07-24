'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    async = require('async'),
    juice = require('juice'),
    moment = require('moment'),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    inviteCodeService = require(path.resolve('./modules/users/server/services/invite-codes.server.service')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    render = require(path.resolve('./config/lib/render')),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    htmlTemplateDir = path.resolve('./modules/core/server/views/email-templates'),
    textTemplateDir = path.resolve('./modules/core/server/views/email-templates-text');

exports.sendMessagesUnread = function(userFrom, userTo, notification, callback) {

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

exports.sendConfirmContact = function(user, friend, contact, messageHTML, messageText, callback) {
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

exports.sendRemoveProfile = function(user, callback) {
  var urlConfirm = url + '/api/profile/remove/' + user.removeProfileToken,
      campaign = 'remove-profile';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Remove profile',
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

exports.sendResetPasswordConfirm = function(user, callback) {
  var campaign = 'remove-profile-confirm';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Your Trustroots profile has been removed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });
  exports.renderEmailAndSend('remove-profile-confirm', params, callback);
};

exports.sendResetPassword = function(user, callback) {
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

exports.sendResetPasswordConfirm = function(user, callback) {

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

exports.sendChangeEmailConfirmation = function(user, callback) {

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

exports.sendSignupEmailConfirmation = function(user, callback) {

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

exports.sendSupportRequest = function(replyTo, supportRequest, callback) {

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

exports.sendSignupEmailReminder = function(user, callback) {

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

exports.sendReactivateHosts = function(user, callback) {
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
exports.sendWelcomeSequenceFirst = function(user, callback) {
  var urlInvite = url + '/invite',
      urlEditProfile = url + '/profile/edit',
      campaign = 'welcome-sequence-first',
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Welcome to Trustroots ' + user.firstName + '!',
    from: {
      // First welcome sequence email has more personal feeling to it:
      name: 'Natalia',
      // ...and uses our support email instead of "no-reply@":
      address: config.supportEmail
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlInvitePlainText: urlInvite,
    urlInvite: analyticsHandler.appendUTMParams(urlInvite, utmParams),
    urlEditProfilePlainText: urlEditProfile,
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('welcome-sequence-first', params, callback);
};

/**
 * 2/3 welcome sequence email
 */
exports.sendWelcomeSequenceSecond = function(user, callback) {
  var inviteCode = inviteCodeService.getCode(),
      signupLabel = config.domain + '/c/' + inviteCode,
      urlSignup = url + '/c/' + inviteCode,
      urlInvite = url + '/invite',
      campaign = 'welcome-sequence-second',
      utmParams = {
        source: 'transactional-email',
        medium: 'email',
        campaign: campaign
      };

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Invite your friends to Trustroots',
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    signupLabel: signupLabel,
    urlInvitePlainText: urlInvite,
    urlInvite: analyticsHandler.appendUTMParams(urlInvite, utmParams),
    urlSignupPlainText: urlSignup,
    urlSignup: analyticsHandler.appendUTMParams(urlSignup, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign
  });

  exports.renderEmailAndSend('welcome-sequence-second', params, callback);
};

/**
 * 3/3 welcome sequence email
 */
exports.sendWelcomeSequenceThird = function(user, callback) {

  // Default topic for emails
  var messageTopic = 'feedback';

  // For members with empty profiles,
  // remind them how important it is to fill their profile.
  var descriptionLength = textProcessor.plainText(user.description, true).length;
  if (descriptionLength < config.profileMinimumLength) {
    messageTopic = 'fill-profile';
  }

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
      // Third welcome sequence email has more personal feeling to it:
      name: 'Mikael',
      // ...and uses our support email instead of "no-reply@":
      address: config.supportEmail
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlEditProfilePlainText: urlEditProfile,
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    topic: messageTopic
  });

  exports.renderEmailAndSend('welcome-sequence-third', params, callback);
};

/**
 * Add several parameters to be used to render transactional emails
 * These variables are used by email base template:
 * `modules/core/server/views/email-templates/email.server.view.html`
 *
 * @param {Object[]} params - Parameters used for rendering emails
 * @returns {Object[]} - Returns object with supportUrl, footerUrl and headerUrl parameters.
 */
exports.addEmailBaseTemplateParams = function(params) {
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

exports.renderEmail = function(templateName, params, callback) {

  var templatePaths = {};

  templatePaths.text = path.join(textTemplateDir, templateName + '.server.view.html');

  if (!params.skipHtmlTemplate) {
    templatePaths.html = path.join(htmlTemplateDir, templateName + '.server.view.html');
  }

  // Rendering in parallel leads to an error. maybe because
  // swig is unmaintained now https://github.com/paularmstrong/swig)
  async.mapValuesSeries(templatePaths, function(templatePath, key, done) {
    render(templatePath, params, function(err, rendered) {

      // there are promises inside render(), need to execute callback in
      // nextTick() so callback can safely throw exceptions
      // see https://github.com/caolan/async/issues/1150
      async.nextTick(function() {
        done(err, rendered);
      });

    });
  }, function(err, result) {
    if (err) return callback(err);
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

exports.renderEmailAndSend = function(templateName, params, callback) {
  exports.renderEmail(templateName, params, function(err, email) {
    if (err) return callback(err);
    agenda.now('send email', email, callback);
  });
};
