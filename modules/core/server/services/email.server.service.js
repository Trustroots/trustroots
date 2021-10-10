/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const async = require('async');
const juice = require('juice');
const moment = require('moment');
const autolinker = require('autolinker');
const analyticsHandler = require(path.resolve(
  './modules/core/server/controllers/analytics.server.controller',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const render = require(path.resolve('./config/lib/render'));
const agenda = require(path.resolve('./config/lib/agenda'));
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));
const url = (config.https ? 'https' : 'http') + '://' + config.domain;

/**
 * Get a randomized name from a list of support volunteer names.
 * Used in welcome sequence emails.
 *
 * @return String
 */
function getSupportVolunteerName() {
  return _.sample(config.supportVolunteerNames);
}

exports.sendMessagesUnread = function (
  userFrom,
  userTo,
  notification,
  callback,
) {
  // Is the notification the first one?
  // If not, we send a different subject.
  const isFirst = !(notification.notificationCount > 0);

  // Generate mail subject
  const mailSubject = isFirst
    ? userFrom.displayName + ' wrote you from Trustroots'
    : userFrom.displayName + ' is still waiting for a reply on Trustroots';

  // URLs to use at email templates
  const urlUserFromProfile = url + '/profile/' + userFrom.username;
  const urlReply = url + '/messages/' + userFrom.username;
  const campaign = 'messages-unread';

  // Variables passed to email text/html templates
  const params = exports.addEmailBaseTemplateParams({
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
      campaign,
      content: 'reply-to',
    }),
    urlUserFromProfilePlainText: urlUserFromProfile,
    urlUserFromProfile: analyticsHandler.appendUTMParams(urlUserFromProfile, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'profile',
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('messages-unread', params, callback);
};

exports.sendConfirmContact = function (
  user,
  friend,
  contact,
  messageHTML,
  messageText,
  callback,
) {
  const meURL = url + '/profile/' + user.username;
  const urlConfirm = url + '/contact-confirm/' + contact._id;
  const campaign = 'confirm-contact';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm contact',
    name: friend.displayName,
    email: friend.email,
    messageHTML,
    messageText,
    meName: user.displayName,
    meURLPlainText: meURL,
    meURL: analyticsHandler.appendUTMParams(meURL, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'profile',
    }),
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'confirm-contact',
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('confirm-contact', params, callback);
};

/**
 * Email with a token to initialize removing a user
 */
exports.sendRemoveProfile = function (user, callback) {
  const urlConfirm = url + '/remove/' + user.removeProfileToken;
  const campaign = 'remove-profile';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm removing your Trustroots profile',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
  });
  exports.renderEmailAndSend('remove-profile', params, callback);
};

/**
 * Email confirmation that user was removed
 */
exports.sendRemoveProfileConfirmed = function (user, callback) {
  const campaign = 'remove-profile-confirmed';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Your Trustroots profile has been removed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });
  exports.renderEmailAndSend('remove-profile-confirmed', params, callback);
};

exports.sendResetPassword = function (user, callback) {
  const urlConfirm = url + '/api/auth/reset/' + user.resetPasswordToken;
  const campaign = 'reset-password';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Password Reset',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
  });
  exports.renderEmailAndSend('reset-password', params, callback);
};

exports.sendResetPasswordConfirm = function (user, callback) {
  const urlResetPassword = url + '/password/forgot';
  const campaign = 'reset-password-confirm';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Your password has been changed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlResetPasswordPlainText: urlResetPassword,
    urlResetPassword: analyticsHandler.appendUTMParams(urlResetPassword, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
  });
  exports.renderEmailAndSend('reset-password-confirm', params, callback);
};

exports.sendChangeEmailConfirmation = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken;
  const campaign = 'confirm-email';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm email change',
    name: user.displayName,
    email: user.emailTemporary,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('email-confirmation', params, callback);
};

exports.sendSignupEmailConfirmation = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true';
  const campaign = 'confirm-email';

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm Email',
    name: user.displayName,
    email: user.emailTemporary || user.email,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('signup', params, callback);
};

exports.sendSupportRequest = function (replyTo, supportRequest, callback) {
  let subject = 'Support request';

  // I miss CoffeeSscript
  if (_.has(supportRequest, 'username') && supportRequest.username) {
    subject += ' from ' + supportRequest.username;
  }
  if (_.has(supportRequest, 'displayName') && supportRequest.displayName) {
    subject += ' (' + supportRequest.displayName + ')';
  }

  const params = {
    from: 'Trustroots Support <' + config.supportEmail + '>',
    name: 'Trustroots Support', // `To:`
    email: config.supportEmail, // `To:`
    replyTo,
    subject,
    request: supportRequest,
    skipHtmlTemplate: true, // Don't render html template for this email
    sparkpostCampaign: 'support-request',
  };

  exports.renderEmailAndSend('support-request', params, callback);
};

exports.sendSignupEmailReminder = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true';
  const campaign = 'signup-reminder';

  // This email is a reminder number `n` to this user
  // Set to `1` (first) if the field doesn't exist yet
  // `publicReminderCount` contains number of reminders already sent to user
  const reminderCount = user.publicReminderCount
    ? user.publicReminderCount + 1
    : 1;

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Complete your signup to Trustroots',
    name: user.displayName,
    email: user.emailTemporary || user.email,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    reminderCount, // This email is a reminder number `n` to this user
    reminderCountMax: config.limits.maxSignupReminders, // Max n of reminders system sends
    timeAgo: moment(user.created).fromNow(), // A string, e.g. `3 days ago`
  });

  // This will be the last reminder, mention that at the email subject line
  if (user.publicReminderCount + 1 === config.limits.maxSignupReminders) {
    params.subject = 'Last chance to complete your signup to Trustroots!';
  }

  exports.renderEmailAndSend('signup-reminder', params, callback);
};

exports.sendReactivateHosts = function (user, callback) {
  const urlOffer = url + '/offer';
  const campaign = 'reactivate-hosts';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = exports.addEmailBaseTemplateParams({
    subject: user.firstName + ', start hosting on Trustroots again?',
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlOfferPlainText: urlOffer,
    urlOffer: analyticsHandler.appendUTMParams(urlOffer, utmParams),
    urlSurveyPlainText: config.surveyReactivateHosts || false,
    urlSurvey: config.surveyReactivateHosts
      ? analyticsHandler.appendUTMParams(
          config.surveyReactivateHosts,
          utmParams,
        )
      : false,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('reactivate-hosts', params, callback);
};

/**
 * 1/3 welcome sequence email
 */
exports.sendWelcomeSequenceFirst = function (user, callback) {
  const urlEditProfile = url + '/profile/edit';
  const urlFAQ = url + '/faq';
  const campaign = 'welcome-sequence-first';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = exports.addEmailBaseTemplateParams({
    subject: '👋 Welcome to Trustroots ' + user.firstName + '!',
    from: {
      name: getSupportVolunteerName(),
      // Use support email instead of default "no-reply@":
      address: config.supportEmail,
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    username: user.username,
    urlFAQ: analyticsHandler.appendUTMParams(urlFAQ, utmParams),
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });

  exports.renderEmailAndSend('welcome-sequence-first', params, callback);
};

/**
 * 2/3 welcome sequence email
 */
exports.sendWelcomeSequenceSecond = function (user, callback) {
  const urlMeet = url + '/offer/meet';
  const campaign = 'welcome-sequence-second';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = exports.addEmailBaseTemplateParams({
    subject: 'Meet new people at Trustroots, ' + user.firstName,
    from: {
      name: getSupportVolunteerName(),
      // Use support email instead of default "no-reply@":
      address: config.supportEmail,
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    username: user.username,
    urlMeetup: analyticsHandler.appendUTMParams(urlMeet, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
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
  const descriptionLength = textService.plainText(
    user.description || '',
    true,
  ).length;
  const messageTopic =
    descriptionLength < config.profileMinimumLength
      ? 'fill-profile'
      : 'feedback';

  const urlEditProfile = url + '/profile/edit';
  const campaign = 'welcome-sequence-third' + '-' + messageTopic;
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = exports.addEmailBaseTemplateParams({
    subject: 'How is it going, ' + user.firstName + '?',
    from: {
      name: getSupportVolunteerName(),
      // Use support email instead of default "no-reply@":
      address: config.supportEmail,
    },
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    username: user.username,
    urlEditProfile: analyticsHandler.appendUTMParams(urlEditProfile, utmParams),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    topic: messageTopic,
  });

  exports.renderEmailAndSend('welcome-sequence-third', params, callback);
};

/**
 * Experience Notification (First between users)
 */
exports.sendExperienceNotificationFirst = function (
  userFrom,
  userTo,
  callback,
) {
  const campaign = 'experience-notification-first';
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;
  const giveExperienceUrl = `${url}/profile/${userFrom.username}/experiences/new`;

  const params = exports.addEmailBaseTemplateParams({
    subject: `${userFrom.displayName} shared their experience with you`,
    email: userTo.email,
    days: config.limits.timeToReplyExperience.days,
    username: userTo.username, // data needed for link to profile in footer
    userFrom,
    userTo,
    userFromProfileUrlPlainText: userFromProfileUrl,
    userFromProfileUrl: analyticsHandler.appendUTMParams(userFromProfileUrl, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'from-profile',
    }),
    giveExperienceUrlPlainText: giveExperienceUrl,
    giveExperienceUrl: analyticsHandler.appendUTMParams(giveExperienceUrl, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'give-experience',
    }),
  });

  exports.renderEmailAndSend('experience-notification-first', params, callback);
};

/**
 * Experience Notification (Second experience between users)
 */
exports.sendExperienceNotificationSecond = function (
  userFrom,
  userTo,
  experience,
  callback,
) {
  const campaign = 'experience-notification-second';
  const seeExperiencesUrl = `${url}/profile/${userTo.username}/experiences#${experience._id}`;
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;

  const params = exports.addEmailBaseTemplateParams({
    subject: `${userFrom.displayName} shared also their experience with you`,
    email: userTo.email,
    username: userTo.username, // data needed for link to profile in footer
    userFrom,
    userTo,
    userFromProfileUrlPlainText: userFromProfileUrl,
    userFromProfileUrl: analyticsHandler.appendUTMParams(userFromProfileUrl, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'from-profile',
    }),
    seeExperiencesUrlPlainText: seeExperiencesUrl,
    seeExperiencesUrl: analyticsHandler.appendUTMParams(seeExperiencesUrl, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'see-experiences',
    }),
  });

  exports.renderEmailAndSend(
    'experience-notification-second',
    params,
    callback,
  );
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
    log(
      'error',
      'addEmailBaseTemplateParams: requires param to be Object. No URL parameters added.',
      params,
    );
    return {};
  }

  const baseUrl = (config.https ? 'https' : 'http') + '://' + config.domain;

  params.urlSupportPlainText = baseUrl + '/support';
  params.footerUrlPlainText = baseUrl;

  const buildAnalyticsUrl = function (url, content) {
    return analyticsHandler.appendUTMParams(url, {
      source: 'transactional-email',
      medium: 'email',
      campaign: params.utmCampaign || 'transactional-email',
      content,
    });
  };

  params.headerUrl = buildAnalyticsUrl(baseUrl, 'email-header');
  params.footerUrl = buildAnalyticsUrl(baseUrl, 'email-footer');
  params.supportUrl = buildAnalyticsUrl(
    params.urlSupportPlainText,
    'email-support',
  );
  if (params.username) {
    params.profileUrl = buildAnalyticsUrl(
      baseUrl + '/profile/' + params.username,
      'email-profile',
    );
  }
  return params;
};

exports.renderEmail = function (templateName, params, callback) {
  const templatePaths = {};

  // `./modules/core/server/views/email-templates-text`
  templatePaths.text = path.join(
    'email-templates-text',
    templateName + '.server.view.html',
  );

  if (!params.skipHtmlTemplate) {
    // `./modules/core/server/views/email-templates`
    templatePaths.html = path.join(
      'email-templates',
      templateName + '.server.view.html',
    );
  }

  // Rendering in parallel leads to an error. maybe because
  // swig is unmaintained now https://github.com/paularmstrong/swig)
  async.mapValuesSeries(
    templatePaths,
    function (templatePath, key, done) {
      render(templatePath, params, function (err, rendered) {
        // there are promises inside render(), need to execute callback in
        // nextTick() so callback can safely throw exceptions
        // see https://github.com/caolan/async/issues/1150
        async.nextTick(function () {
          done(err, rendered);
        });
      });
    },
    function (err, result) {
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
        replaceFn(match) {
          return '<' + match.getAnchorHref() + '>';
        },
      });

      const email = {
        to: {
          name: params.name,
          address: params.email,
        },
        from: params.from || 'Trustroots <' + config.mailer.from + '>',
        subject: params.subject,
        text: result.text,
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
            campaign_id: params.sparkpostCampaign,
          },
        };
      }
      callback(null, email);
    },
  );
};

exports.renderEmailAndSend = function (templateName, params, callback) {
  exports.renderEmail(templateName, params, function (err, email) {
    if (err) return callback(err);
    agenda.now('send email', email, callback);
  });
};
