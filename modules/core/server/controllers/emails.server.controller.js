'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    analyticsHandler = require(path.resolve('./modules/core/server/controllers/analytics.server.controller')),
    config = require(path.resolve('./config/config'));

/**
 * Add several parameters to be used to render transactional emails
 * These variables are used by email base template:
 * `modules/core/server/views/email-templates/email.server.view.html`
 *
 * @param {String} host - Host/domain
 * @param {Object[]} params - Parameters used for rendering emails
 * @param {String=} utmCampaign - Optional UTM campaign parameter, probably email's type such as "email-reset"
 * @returns {Object[]} - Returns object with supportUrl, footerUrl and headerUrl parameters.
 */
exports.addEmailBaseTemplateParams = function(host, params, utmCampaign) {
  if (params === null || typeof params !== 'object') {
    console.error('appendUrlParams: requires param to be Object. No URL parameters added.');
    return {};
  }

  if (!host) {
    console.error('appendUrlParams: requires host.');
    return params;
  }

  var baseUrl = (config.https ? 'https' : 'http') + '://' + host;

  params.urlSupportPlainText = baseUrl + '/support';
  params.footerUrlPlainText = baseUrl;

  params.headerUrl = analyticsHandler.appendUTMParams(baseUrl, {
    source: 'transactional-email',
    medium: 'email',
    campaign: utmCampaign || 'transactional-email',
    content: 'email-header'
  });

  params.footerUrl = analyticsHandler.appendUTMParams(baseUrl, {
    source: 'transactional-email',
    medium: 'email',
    campaign: utmCampaign || 'transactional-email',
    content: 'email-footer'
  });

  params.supportUrl = analyticsHandler.appendUTMParams(params.urlSupportPlainText, {
    source: 'transactional-email',
    medium: 'email',
    campaign: utmCampaign || 'transactional-email',
    content: 'email-support'
  });

  return params;
};
