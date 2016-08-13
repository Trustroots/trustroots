'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    async = require('async'),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    render = require(path.resolve('./config/lib/render')),
    agenda = require(path.resolve('./config/lib/agenda')),
    config = require(path.resolve('./config/config')),
    url = (config.https ? 'https' : 'http') + '://' + config.domain,
    htmlTemplateDir = path.resolve('./modules/core/server/views/email-templates'),
    textTemplateDir = path.resolve('./modules/core/server/views/email-templates-text');

exports.sendMessagesUnread = function(userFrom, userTo, notification, callback) {

  // Generate mail subject
  var mailSubject = userFrom.displayName + ' wrote you from Trustroots';

  // URLs to use at email templates
  var urlUserFromProfile = url + '/profile/' + userFrom.username,
      urlReply = url + '/messages/' + userFrom.username;

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
      campaign: 'messages-unread',
      content: 'reply-to'
    }),
    urlUserFromProfilePlainText: urlUserFromProfile,
    urlUserFromProfile: analyticsHandler.appendUTMParams(urlUserFromProfile, {
      source: 'transactional-email',
      medium: 'email',
      campaign: 'messages-unread',
      content: 'profile'
    }),
    utmCampaign: 'messages-unread'
  });

  exports.renderEmailAndSend('messages-unread', params, callback);
};

exports.sendConfirmContact = function(user, friend, contact, messageHTML, messageText, callback) {
  var meURL = url + '/profile/' + user.username,
      urlConfirm = url + '/contact-confirm/' + contact._id;

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
      campaign: 'confirm-contact',
      content: 'profile'
    }),
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: 'confirm-contact',
      content: 'confirm-contact'
    }),
    utmCampaign: 'confirm-contact'
  });

  exports.renderEmailAndSend('confirm-contact', params, callback);
};

exports.sendResetPassword = function(user, callback) {
  var urlConfirm = url + '/api/auth/reset/' + user.resetPasswordToken;
  var params = exports.addEmailBaseTemplateParams({
    subject: 'Password Reset',
    name: user.displayName,
    email: user.email,
    utmCampaign: 'reset-password',
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: 'reset-password'
    })
  });
  exports.renderEmailAndSend('reset-password', params, callback);
};

exports.sendResetPasswordConfirm = function(user, callback) {

  var urlResetPassword = url + '/password/forgot';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Your password has been changed',
    name: user.displayName,
    email: user.email,
    utmCampaign: 'reset-password-confirm',
    urlResetPasswordPlainText: urlResetPassword,
    urlResetPassword: analyticsHandler.appendUTMParams(urlResetPassword, {
      source: 'transactional-email',
      medium: 'email',
      campaign: 'reset-password-confirm'
    })
  });
  exports.renderEmailAndSend('reset-password-confirm', params, callback);
};

exports.sendChangeEmailConfirmation = function(user, callback) {

  var urlConfirm = url + '/confirm-email/' + user.emailToken,
      utmCampaign = 'confirm-email';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm email change',
    name: user.displayName,
    email: user.emailTemporary,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: utmCampaign
    }),
    utmCampaign: utmCampaign
  });

  exports.renderEmailAndSend('email-confirmation', params, callback);
};

exports.sendSignupEmailConfirmation = function(user, callback) {

  var urlConfirm = url + '/confirm-email/' + user.emailToken + '?signup',
      utmCampaign = 'confirm-email';

  var params = exports.addEmailBaseTemplateParams({
    subject: 'Confirm Email',
    name: user.displayName,
    email: user.emailTemporary,
    urlConfirmPlainText: urlConfirm,
    urlConfirm: analyticsHandler.appendUTMParams(urlConfirm, {
      source: 'transactional-email',
      medium: 'email',
      campaign: utmCampaign
    }),
    utmCampaign: utmCampaign
  });

  exports.renderEmailAndSend('signup', params, callback);
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

  var htmlTemplatePath = path.join(htmlTemplateDir, templateName + '.server.view.html');
  var textTemplatePath = path.join(textTemplateDir, templateName + '.server.view.html');

  // Rendering in parallel leads to an error. maybe because
  // swig is unmaintained now https://github.com/paularmstrong/swig)
  async.mapValuesSeries({
    html: htmlTemplatePath,
    text: textTemplatePath
  }, function(templatePath, key, done) {
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
      from: 'Trustroots <' + config.mailer.from + '>',
      subject: params.subject,
      html: result.html,
      text: result.text
    };
    callback(null, email);
  });
};

exports.renderEmailAndSend = function(templateName, params, callback) {
  exports.renderEmail(templateName, params, function(err, email) {
    if (err) return callback(err);
    agenda.now('send email', email, callback);
  });
};
