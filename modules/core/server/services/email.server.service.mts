import {
  notificationEmail,
  type NotificationEmail,
} from '../../../users/server/services/notification-email.server.service.mts';
import type { Types } from 'mongoose';
import {
  sendSignupReminderJob,
  type SignupReminder,
} from '../../../users/server/services/signup-reminder.server.service.mts';
import { emailToken } from '../../../users/server/services/action-token.server.service.mts';
import { timeAgo } from '../../shared/time-ago.mts';
import { Autolinker as autolinker } from 'autolinker';
import * as he from 'he';
import { trustrootsLink } from '../../shared/trustroots-links.mts';
import analyticsHandler from './../controllers/analytics.server.controller.mts';
import textService from './text.server.service.mts';
import {
  messagePlainText,
  sanitiseMessageHtml,
} from './message-format.server.service.mts';
import { renderEmail as renderTemplate } from '@trustroots/emails';
import agendaModule from './../../../../config/lib/agenda.mts';
import config from './../../../../config/config.mts';
import logModule from '@trustroots/logger';
import userRolesService from './../../../users/server/services/user-roles.server.service.mts';
import categories from '../../../support/shared/categories.ts';
type MailCallback<Result = import('agenda').Job> = (
  error?: Error | null,
  result?: Result,
) => void;
interface MailUser {
  _id?: Types.ObjectId | string;
  displayName?: string;
  firstName?: string;
  username?: string;
  email?: string;
  emailTemporary?: string;
  roles?: string[];
  description?: string;
  emailToken?: string;
  resetPasswordToken?: string;
  removeProfileToken?: string;
}
interface UnreadNotification {
  notificationCount?: number;
  total?: number;
  messages: Array<Record<string, unknown> & { content: string }>;
}
interface SupportMailRequest extends Record<string, unknown> {
  category: string;
  username?: string;
  displayName?: string;
}
export interface EmailTemplateParams extends Record<string, unknown> {
  name?: string;
  email?: string;
  from?: string | { name?: string; address?: string };
  replyTo?: string | { name?: string; address?: string };
  subject?: string;
  notificationEmail?: NotificationEmail;
  signupReminder?: SignupReminder;
  sparkpostCampaign?: string;
}
interface BaseEmailUrls extends Record<string, unknown> {
  urlSupportPlainText: string;
  headerUrl: string;
  footerUrl: string;
  supportUrl: string;
  profileUrl?: string;
}
export interface RenderedEmail {
  to: { name?: string; address?: string };
  from: string | { name?: string; address?: string };
  subject?: string;
  text: string;
  html?: string;
  replyTo?: string | { name?: string; address?: string };
  headers?: Record<string, string>;
  notificationEmail?: NotificationEmail;
  signupReminder?: SignupReminder;
}
const agenda = agendaModule as import('agenda').Agenda;
const log = logModule as (
  level: string,
  message: string,
  metadata?: unknown,
) => void;

const service = {
  sendMessagesUnread,
  sendConfirmContact,
  sendRemoveProfile,
  sendRemoveProfileConfirmed,
  sendResetPassword,
  sendResetPasswordConfirm,
  sendChangeEmailConfirmation,
  sendSignupEmailConfirmation,
  sendFlaggedSignupAlert,
  sendSupportRequest,
  sendSignupEmailReminder,
  sendReactivateHosts,
  sendWelcomeSequenceFirst,
  sendWelcomeSequenceSecond,
  sendWelcomeSequenceThird,
  sendExperienceNotificationFirst,
  sendExperienceNotificationSecond,
  addEmailBaseTemplateParams,
  renderEmail,
  renderEmailAndSend,
};

/**
 * Module dependencies.
 */

const { SUPPORT_CATEGORIES } = categories;
const supportCategoryLabels: Record<string, string> = SUPPORT_CATEGORIES;
const url = (config.https ? 'https' : 'http') + '://' + config.domain;

/**
 * Get a randomized name from a list of support volunteer names.
 * Used in welcome sequence emails.
 *
 * @return String
 */
function getSupportVolunteerName() {
  return config.supportVolunteerNames[
    Math.floor(Math.random() * config.supportVolunteerNames.length)
  ];
}
function defangUrl(value: string) {
  return value.replace(/:/g, '[:]').replace(/\./g, '[.]');
}
function messagePreview(content: string) {
  const sanitised = sanitiseMessageHtml(content, {
    ...textService.sanitizeOptions,
    // Retain labels when the sanitiser removes an invalid href.
    exclusiveFilter: undefined,
  });
  const linked = autolinker.link(sanitised, {
    urls: true,
    email: false,
    phone: false,
    mention: false,
    hashtag: false,
    replaceFn(match) {
      const destination = trustrootsLink(he.decode(match.getAnchorHref()), url);
      return destination
        ? `<a href="${he.escape(destination.href)}">${he.escape(he.decode(match.getMatchedText()))}</a>`
        : he.escape(defangUrl(he.decode(match.getMatchedText())));
    },
  });
  // The sanitiser and autolinker above produce anchors with at most one attribute.
  const html = linked.replace(
    /<a(?: href="([^"]*)")?>([\s\S]*?)<\/a>/g,
    (_anchor, href: string | undefined, label: string) => {
      if (href === undefined) {
        return autolinker.link(label, {
          email: false,
          phone: false,
          replaceFn: match =>
            he.escape(defangUrl(he.decode(match.getMatchedText()))),
        });
      }
      const decoded = he.decode(href);
      const destination = trustrootsLink(decoded, url);
      if (!destination) return he.escape(defangUrl(decoded));
      return `<a href="${he.escape(destination.href)}">${label}</a>`;
    },
  );
  return {
    content: html.replace(/<p(?=[ >])/g, '<p style="margin:0"'),
    plainText: messagePlainText(html, true),
  };
}
function sendMessagesUnread(
  userFrom: MailUser,
  userTo: MailUser,
  notification: UnreadNotification,
  callback: MailCallback,
) {
  if (
    userRolesService.hasRestrictedMessagingRole(userFrom) ||
    userRolesService.hasRestrictedMessagingRole(userTo)
  ) {
    return callback();
  }

  // Is the notification the first one?
  // If not, we send a different subject.
  const isFirst = !(notification.notificationCount! > 0);

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
    ...notificationEmail(userTo, 'messages', 'immediate'),
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
    messageCount: notification.total ?? notification.messages.length,
    messages: notification.messages.map(message =>
      messagePreview(message.content),
    ),
    userFromName: userFrom.displayName,
    userToName: userTo.displayName,
    urlReply: analyticsHandler.appendUTMParams(urlReply, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
      content: 'reply-to',
    }),
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
}
export function sendMessageDigest(
  user: MailUser,
  frequency: 'daily' | 'weekly',
  conversations: Array<{
    username: string;
    displayName: string;
    count: number;
  }>,
  callback: MailCallback,
) {
  const subject = 'Unread messages on Trustroots';
  const campaign = 'messages-digest';
  const params = service.addEmailBaseTemplateParams({
    ...notificationEmail(user, 'messages', frequency),
    subject,
    name: user.displayName,
    email: user.email,
    conversations: conversations.map(conversation => ({
      ...conversation,
      url: url + '/messages/' + encodeURIComponent(conversation.username),
    })),
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });
  service.renderEmailAndSend('messages-digest', params, callback);
}

function sendConfirmContact(
  user: MailUser,
  friend: MailUser,
  contact: { _id?: unknown },
  messageHTML: string | false,
  callback: MailCallback,
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
    meName: user.displayName,
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
}

/**
 * Email with a token to initialize removing a user
 */
function sendRemoveProfile(user: MailUser, callback: MailCallback) {
  const urlConfirm = url + '/remove/' + emailToken(user, 'removeProfileToken');
  const campaign = 'remove-profile';
  const params = service.addEmailBaseTemplateParams({
    subject: 'Confirm removing your Trustroots profile',
    urlCancel: url + '/profile/edit/account#remove',
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
}

/**
 * Email confirmation that user was removed
 */
function sendRemoveProfileConfirmed(user: MailUser, callback: MailCallback) {
  const campaign = 'remove-profile-confirmed';
  const params = service.addEmailBaseTemplateParams({
    subject: 'Your Trustroots profile has been removed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
  });
  service.renderEmailAndSend('remove-profile-confirmed', params, callback);
}
function sendResetPassword(user: MailUser, callback: MailCallback) {
  const urlConfirm =
    url + '/api/auth/reset/' + emailToken(user, 'resetPasswordToken');
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
}
function sendResetPasswordConfirm(user: MailUser, callback: MailCallback) {
  const urlResetPassword = url + '/password/forgot';
  const campaign = 'reset-password-confirm';
  const params = service.addEmailBaseTemplateParams({
    subject: 'Your password has been changed',
    name: user.displayName,
    email: user.email,
    utmCampaign: campaign,
    sparkpostCampaign: campaign,
    urlResetPassword: analyticsHandler.appendUTMParams(urlResetPassword, {
      source: 'transactional-email',
      medium: 'email',
      campaign,
    }),
  });
  service.renderEmailAndSend('reset-password-confirm', params, callback);
}
function sendChangeEmailConfirmation(user: MailUser, callback: MailCallback) {
  const urlConfirm = url + '/confirm-email/' + emailToken(user, 'emailToken');
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
}
function sendSignupEmailConfirmation(user: MailUser, callback: MailCallback) {
  const urlConfirm =
    url + '/confirm-email/' + emailToken(user, 'emailToken') + '?signup=true';
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
}
function sendFlaggedSignupAlert(
  user: MailUser,
  matchedKeywords: string[],
  callback: MailCallback,
) {
  const params = {
    from: 'Trustroots Support <' + config.supportEmail + '>',
    name: 'Trustroots Support',
    email: config.supportEmail,
    subject: 'Signup matched safety-review keywords',
    matchedKeywords: matchedKeywords.join(', '),
    memberName: user.displayName,
    username: user.username,
    adminProfileUrl: url + '/admin/user?id=' + user._id,
    sparkpostCampaign: 'flagged-signup-alert',
  };
  service.renderEmailAndSend('flagged-signup-alert', params, callback);
}
function sendSupportRequest(
  replyTo: NonNullable<EmailTemplateParams['replyTo']>,
  supportRequest: SupportMailRequest,
  callback: MailCallback,
) {
  let subject = 'Support request';
  const categoryLabel =
    supportCategoryLabels[supportRequest.category] || 'Other';
  subject += ' [' + categoryLabel + ']';

  if (supportRequest.username) {
    subject += ' from ' + supportRequest.username;
  }
  if (supportRequest.displayName) {
    subject += ' (' + supportRequest.displayName + ')';
  }
  const params = {
    from: 'Trustroots Support <' + config.supportEmail + '>',
    name: 'Trustroots Support',
    // `To:`
    email: config.supportEmail,
    // `To:`
    replyTo,
    subject,
    request: {
      ...supportRequest,
      categoryLabel,
    },
    sparkpostCampaign: 'support-request',
  };
  service.renderEmailAndSend('support-request', params, callback);
}
function sendSignupEmailReminder(
  user: MailUser & {
    publicReminderCount?: number;
    created?: Date | string | number;
  },
  callback: MailCallback,
  signupReminder?: SignupReminder,
) {
  const urlConfirm =
    url + '/confirm-email/' + emailToken(user, 'emailToken') + '?signup=true';
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
    reminderCount,
    signupReminder,
    // This email is a reminder number `n` to this user
    reminderCountMax: config.limits.maxSignupReminders,
    // Max n of reminders system sends
    timeAgo: timeAgo(new Date(user.created ?? Date.now())), // A string, e.g. `3 days ago`
  });

  // This will be the last reminder, mention that at the email subject line
  if (user.publicReminderCount! + 1 === config.limits.maxSignupReminders) {
    params.subject = 'Last chance to complete your signup to Trustroots!';
  }
  service.renderEmailAndSend('signup-reminder', params, callback);
}
function sendReactivateHosts(user: MailUser, callback: MailCallback) {
  const urlOffer = url + '/offer';
  const campaign = 'reactivate-hosts';
  const utmParams = {
    source: 'transactional-email',
    medium: 'email',
    campaign,
  };
  const params = service.addEmailBaseTemplateParams({
    ...notificationEmail(user, 'hosting'),
    subject: user.firstName + ', start hosting on Trustroots again?',
    firstName: user.firstName,
    name: user.displayName,
    email: user.email,
    urlOffer: analyticsHandler.appendUTMParams(urlOffer, utmParams),
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
}

/**
 * 1/3 welcome sequence email
 */
function sendWelcomeSequenceFirst(user: MailUser, callback: MailCallback) {
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
}

/**
 * 2/3 welcome sequence email
 */
function sendWelcomeSequenceSecond(user: MailUser, callback: MailCallback) {
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
}

/**
 * 3/3 welcome sequence email
 */
function sendWelcomeSequenceThird(user: MailUser, callback: MailCallback) {
  // For members with empty profiles,
  // remind them how important it is to fill their profile.
  // Ask for feedback from the rest.
  const descriptionLength = textService.plainText(user.description).length;
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
}

/**
 * Experience Notification (First between users)
 */
function sendExperienceNotificationFirst(
  userFrom: MailUser,
  userTo: MailUser,
  callback: MailCallback,
) {
  if (
    userRolesService.hasRestrictedMessagingRole(userFrom) ||
    userRolesService.hasRestrictedMessagingRole(userTo)
  ) {
    return callback();
  }
  const campaign = 'experience-notification-first';
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;
  const giveExperienceUrl = `${url}/profile/${userFrom.username}/experiences/new`;
  const params = service.addEmailBaseTemplateParams({
    subject: `${userFrom.displayName} shared their experience with you`,
    email: userTo.email,
    days: config.limits.timeToReplyExperience.days,
    username: userTo.username,
    // data needed for link to profile in footer
    userFrom,
    userTo,
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
}

/**
 * Experience Notification (Second experience between users)
 */
function sendExperienceNotificationSecond(
  userFrom: MailUser,
  userTo: MailUser,
  experience: { _id?: unknown },
  callback: MailCallback,
) {
  if (
    userRolesService.hasRestrictedMessagingRole(userFrom) ||
    userRolesService.hasRestrictedMessagingRole(userTo)
  ) {
    return callback();
  }
  const campaign = 'experience-notification-second';
  const seeExperiencesUrl = `${url}/profile/${userTo.username}/experiences#${experience._id}`;
  const userFromProfileUrl = `${url}/profile/${userFrom.username}`;
  const params = service.addEmailBaseTemplateParams({
    subject: `${userFrom.displayName} shared also their experience with you`,
    email: userTo.email,
    username: userTo.username,
    // data needed for link to profile in footer
    userFrom,
    userTo,
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
}

/**
 * Add several parameters to be used to render transactional emails
 * These variables are used by email base template:
 * `packages/emails/src/components/layout.tsx`
 *
 * @param {Object[]} params - Parameters used for rendering emails
 * @returns {Object[]} - Returns object with supportUrl, footerUrl and headerUrl parameters.
 */
function addEmailBaseTemplateParams<T extends object>(
  params: T,
): T & BaseEmailUrls;
function addEmailBaseTemplateParams(params: unknown): Record<string, unknown>;
function addEmailBaseTemplateParams(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object') {
    log(
      'error',
      'addEmailBaseTemplateParams: requires param to be Object. No URL parameters added.',
      input,
    );
    return {};
  }
  const params = input as Record<string, unknown>;
  const baseUrl = (config.https ? 'https' : 'http') + '://' + config.domain;
  params.urlSupportPlainText = baseUrl + '/support';
  const buildAnalyticsUrl = function (url: string, content: string) {
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
    params.urlSupportPlainText as string,
    'email-support',
  );
  if (params.username) {
    params.profileUrl = buildAnalyticsUrl(
      baseUrl + '/profile/' + params.username,
      'email-profile',
    );
  }
  return params;
}
function renderEmail(
  templateName: string,
  params: EmailTemplateParams,
  callback: MailCallback<RenderedEmail>,
) {
  renderTemplate(templateName, params).then(
    result => {
      if (!result.html) {
        // Clean out html entities (like &gt;) from plain text emails
        result.text = textService.plainText(result.text);

        // Wrap links with `<` and `>` from plain text emails
        result.text = autolinker.link(result.text, {
          urls: true,
          email: false,
          phone: false,
          mention: false,
          hashtag: false,
          // Stryker disable next-line BooleanLiteral: replaceFn writes the full href, so the anchor text this strips is never used
          stripPrefix: false,
          replaceFn(match) {
            return '<' + match.getAnchorHref() + '>';
          },
        });
      }
      const email: RenderedEmail = {
        to: {
          name: params.name,
          address: params.email,
        },
        from: params.from || 'Trustroots <' + config.mailer.from + '>',
        subject: params.subject,
        text: result.text,
      };
      if (params.notificationEmail)
        email.notificationEmail = params.notificationEmail;
      if (params.signupReminder) email.signupReminder = params.signupReminder;
      if (result.html) email.html = result.html;
      if (params.replyTo) {
        email.replyTo = params.replyTo;
      }
      // Add SparkPost SMTP API headers
      // @link https://developers.sparkpost.com/api/smtp/#header-using-the-x-msys-api-custom-header
      const sparkpostHeader: {
        options: { transactional: true };
        campaign_id?: string;
      } = {
        options: {
          transactional: true,
        },
      };
      // Stryker disable next-line ConditionalExpression: callers pass a campaign or none, and JSON.stringify drops an undefined campaign_id
      if (params.sparkpostCampaign) {
        sparkpostHeader.campaign_id = params.sparkpostCampaign;
      }
      email.headers = {
        'X-MSYS-API': JSON.stringify(sparkpostHeader),
      };
      // Keep callers outside the promise chain so callback exceptions propagate.
      process.nextTick(() => callback(null, email));
    },
    err => process.nextTick(() => callback(err)),
  );
}
function renderEmailAndSend(
  templateName: string,
  params: EmailTemplateParams,
  callback: MailCallback<import('agenda').Job>,
) {
  service.renderEmail(templateName, params, function (err, email) {
    if (err) return callback(err);
    if (!email)
      return callback(new Error('Email renderer returned no message'));
    agenda
      .now(email.signupReminder ? sendSignupReminderJob : 'send email', email)
      .then(function (job) {
        callback(null, job);
      })
      .catch(callback);
  });
}

export default service;
/** @esmNamed */
export {
  addEmailBaseTemplateParams,
  renderEmail,
  renderEmailAndSend,
  sendChangeEmailConfirmation,
  sendConfirmContact,
  sendExperienceNotificationFirst,
  sendExperienceNotificationSecond,
  sendFlaggedSignupAlert,
  sendMessagesUnread,
  sendReactivateHosts,
  sendRemoveProfile,
  sendRemoveProfileConfirmed,
  sendResetPassword,
  sendResetPasswordConfirm,
  sendSignupEmailConfirmation,
  sendSignupEmailReminder,
  sendSupportRequest,
  sendWelcomeSequenceFirst,
  sendWelcomeSequenceSecond,
  sendWelcomeSequenceThird,
};
