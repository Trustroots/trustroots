import _ from 'lodash';
import path from 'path';
import async from 'async';
import juice from 'juice';
import moment from 'moment';
import autolinker from 'autolinker';
import he from 'he';
import analyticsHandler from '../controllers/analytics.server.controller.js';
import textService from './text.server.service.js';
import render from '../../../../config/lib/render.js';
import agenda from '../../../../config/lib/agenda.js';
import config from '../../../../config/config.js';
import log from '../../../../config/lib/logger.js';
import userRolesService from '../../../users/server/services/user-roles.server.service.js';
import categories from '../../../support/shared/categories.js';

const service = {};

/**
 * Module dependencies.
 */

const { SUPPORT_CATEGORIES } = categories;
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

function defangUrl(value) {
  return value.replace(/:/g, '[:]').replace(/\./g, '[.]');
}

function removeLinksFromMessagePreview(content) {
  const withoutAnchors = _.toString(content).replace(
    /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/a>/gi,
    (_anchor, _quote, href) => _.escape(defangUrl(he.decode(href))),
  );

  return autolinker.link(withoutAnchors, {
    urls: true,
    email: false,
    phone: false,
    mention: false,
    hashtag: false,
    replaceFn: match => _.escape(defangUrl(match.getMatchedText())),
  });
}

service.sendMessagesUnread = function (
  userFrom,
  userTo,
  notification,
  callback,
) {
  if (
    userRolesService.hasRestrictedMessagingRole(userFrom) ||
    userRolesService.hasRestrictedMessagingRole(userTo)
  ) {
    return callback();
  }

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
  const params = service.addEmailBaseTemplateParams({
    // Messages sent by administrators (including scam warnings) are
    // delivered as official Trustroots support mail rather than from an
    // individual administrator account.
    from:
      userFrom.roles && userFrom.roles.includes('admin')
        ? 'Trustroots Support <' + config.supportEmail + '>'
        : undefined,
    subject: mailSubject,
    name: userTo.displayName,
    email: userTo.email,
    mailTitle: mailSubject,
    messageCount: notification.messages.length,
    messages: notification.messages.map(function (message) {
      return Object.assign({}, message, {
        content: removeLinksFromMessagePreview(message.content),
      });
    }),
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

  service.renderEmailAndSend('messages-unread', params, callback);
};

service.sendConfirmContact = function (
  user,
  friend,
  contact,
  messageHTML,
  messageText,
  callback,
) {
  if (
    userRolesService.hasRestrictedMessagingRole(user) ||
    userRolesService.hasRestrictedMessagingRole(friend)
  ) {
    return callback();
  }

  const meURL = url + '/profile/' + user.username;
  const urlConfirm = url + '/contact-confirm/' + contact._id;
  const campaign = 'confirm-contact';

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('confirm-contact', params, callback);
};

/**
 * Email with a token to initialize removing a user
 */
service.sendRemoveProfile = function (user, callback) {
  const urlConfirm = url + '/remove/' + user.removeProfileToken;
  const campaign = 'remove-profile';

  const params = service.addEmailBaseTemplateParams({
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
  service.renderEmailAndSend('remove-profile', params, callback);
};

/**
 * Email confirmation that user was removed
 */
service.sendRemoveProfileConfirmed = function (user, callback) {
  const campaign = 'remove-profile-confirmed';

  const params = service.addEmailBaseTemplateParams({
    subject: 'Your Trustroots profile has been removed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });
  service.renderEmailAndSend('remove-profile-confirmed', params, callback);
};

service.sendResetPassword = function (user, callback) {
  const urlConfirm = url + '/api/auth/reset/' + user.resetPasswordToken;
  const campaign = 'reset-password';

  const params = service.addEmailBaseTemplateParams({
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
  service.renderEmailAndSend('reset-password', params, callback);
};

service.sendResetPasswordConfirm = function (user, callback) {
  const urlResetPassword = url + '/password/forgot';
  const campaign = 'reset-password-confirm';

  const params = service.addEmailBaseTemplateParams({
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
  service.renderEmailAndSend('reset-password-confirm', params, callback);
};

service.sendChangeEmailConfirmation = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken;
  const campaign = 'confirm-email';

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('email-confirmation', params, callback);
};

service.sendSignupEmailConfirmation = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true';
  const campaign = 'confirm-email';

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('signup', params, callback);
};

service.sendFlaggedSignupAlert = function (user, matchedKeywords, callback) {
  const params = {
    from: 'Trustroots Support <' + config.supportEmail + '>',
    name: 'Trustroots Support',
    email: config.supportEmail,
    subject: 'Signup matched safety-review keywords',
    matchedKeywords: matchedKeywords.join(', '),
    memberName: user.displayName,
    username: user.username,
    adminProfileUrl: url + '/admin/user?id=' + user._id,
    skipHtmlTemplate: true,
    sparkpostCampaign: 'flagged-signup-alert',
  };

  service.renderEmailAndSend('flagged-signup-alert', params, callback);
};

service.sendSupportRequest = function (replyTo, supportRequest, callback) {
  let subject = 'Support request';
  const categoryLabel = SUPPORT_CATEGORIES[supportRequest.category] || 'Other';
  subject += ' [' + categoryLabel + ']';

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
    request: { ...supportRequest, categoryLabel },
    skipHtmlTemplate: true, // Don't render html template for this email
    sparkpostCampaign: 'support-request',
  };

  service.renderEmailAndSend('support-request', params, callback);
};

service.sendSignupEmailReminder = function (user, callback) {
  const urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup=true';
  const campaign = 'signup-reminder';

  // This email is a reminder number `n` to this user
  // Set to `1` (first) if the field doesn't exist yet
  // `publicReminderCount` contains number of reminders already sent to user
  const reminderCount = user.publicReminderCount
    ? user.publicReminderCount + 1
    : 1;

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('signup-reminder', params, callback);
};

service.sendReactivateHosts = function (user, callback) {
  const urlOffer = url + '/offer';
  const campaign = 'reactivate-hosts';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('reactivate-hosts', params, callback);
};

/**
 * 1/3 welcome sequence email
 */
service.sendWelcomeSequenceFirst = function (user, callback) {
  const urlEditProfile = url + '/profile/edit';
  const urlFAQ = url + '/faq';
  const campaign = 'welcome-sequence-first';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('welcome-sequence-first', params, callback);
};

/**
 * 2/3 welcome sequence email
 */
service.sendWelcomeSequenceSecond = function (user, callback) {
  const urlMeet = url + '/offer/meet';
  const campaign = 'welcome-sequence-second';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('welcome-sequence-second', params, callback);
};

/**
 * 3/3 welcome sequence email
 */
service.sendWelcomeSequenceThird = function (user, callback) {
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

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('welcome-sequence-third', params, callback);
};

/**
 * Experience Notification (First between users)
 */
service.sendExperienceNotificationFirst = function (
  userFrom,
  userTo,
  callback,
) {
  const campaign = 'experience-notification-first';
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;
  const giveExperienceUrl = `${url}/profile/${userFrom.username}/experiences/new`;

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend('experience-notification-first', params, callback);
};

/**
 * Experience Notification (Second experience between users)
 */
service.sendExperienceNotificationSecond = function (
  userFrom,
  userTo,
  experience,
  callback,
) {
  const campaign = 'experience-notification-second';
  const seeExperiencesUrl = `${url}/profile/${userTo.username}/experiences#${experience._id}`;
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;

  const params = service.addEmailBaseTemplateParams({
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

  service.renderEmailAndSend(
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
service.addEmailBaseTemplateParams = function (params) {
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

service.renderEmail = function (templateName, params, callback) {
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
      // Add SparkPost SMTP API headers
      // @link https://developers.sparkpost.com/api/smtp/#header-using-the-x-msys-api-custom-header
      const sparkpostHeader = { options: { transactional: true } };
      if (params.sparkpostCampaign) {
        sparkpostHeader.campaign_id = params.sparkpostCampaign;
      }
      email.headers = {
        'X-MSYS-API': JSON.stringify(sparkpostHeader),
      };
      callback(null, email);
    },
  );
};

service.renderEmailAndSend = function (templateName, params, callback) {
  service.renderEmail(templateName, params, function (err, email) {
    if (err) return callback(err);
    agenda
      .now('send email', email)
      .then(function (job) {
        callback(null, job);
      })
      .catch(callback);
  });
};

const defaultExport = service;
export default defaultExport;
export const addEmailBaseTemplateParams =
  defaultExport.addEmailBaseTemplateParams;
export const renderEmail = defaultExport.renderEmail;
export const renderEmailAndSend = defaultExport.renderEmailAndSend;
export const sendChangeEmailConfirmation =
  defaultExport.sendChangeEmailConfirmation;
export const sendConfirmContact = defaultExport.sendConfirmContact;
export const sendExperienceNotificationFirst =
  defaultExport.sendExperienceNotificationFirst;
export const sendExperienceNotificationSecond =
  defaultExport.sendExperienceNotificationSecond;
export const sendFlaggedSignupAlert = defaultExport.sendFlaggedSignupAlert;
export const sendMessagesUnread = defaultExport.sendMessagesUnread;
export const sendReactivateHosts = defaultExport.sendReactivateHosts;
export const sendRemoveProfile = defaultExport.sendRemoveProfile;
export const sendRemoveProfileConfirmed =
  defaultExport.sendRemoveProfileConfirmed;
export const sendResetPassword = defaultExport.sendResetPassword;
export const sendResetPasswordConfirm = defaultExport.sendResetPasswordConfirm;
export const sendSignupEmailConfirmation =
  defaultExport.sendSignupEmailConfirmation;
export const sendSignupEmailReminder = defaultExport.sendSignupEmailReminder;
export const sendSupportRequest = defaultExport.sendSupportRequest;
export const sendWelcomeSequenceFirst = defaultExport.sendWelcomeSequenceFirst;
export const sendWelcomeSequenceSecond =
  defaultExport.sendWelcomeSequenceSecond;
export const sendWelcomeSequenceThird = defaultExport.sendWelcomeSequenceThird;
