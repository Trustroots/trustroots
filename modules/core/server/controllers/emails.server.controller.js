'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    amqp = require('amqp'),
    Promise = require('bluebird'),
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


/**
 * Pushes generated emails to RabbitMQ for sending
 */
exports.pushToQueue = function(message, messageOptions) {
  console.log('->emails->sendEmail');
  return new Promise(function(resolve, reject) {
    return reject(new Error('test'));
/*
    if (message === null || typeof message !== 'object') {
      var err = new Error('Failed to put message to queue: message missing.');
      console.error('sendEmail: Message object error.', err);
      return reject(err);
    }

    // Set default message options
    var publishOptions = _.extend({
      contentType: 'application/json',
      type: 'email', // Just a category label, can be anything
      priority: 5 // 0-9; Larger numbers indicate higher priority
    }, messageOptions || {});

    // Create connection to RabbitMQ
    var queueConnection = amqp.createConnection(config.rabbitmq.options);

    queueConnection.on('error', function(err) {
      console.error('sendEmail: Error connecting to RabbitMQ', err);
      return reject(err);
    });

    queueConnection.on('ready', function() {
      console.log('->emails->queueConnection ready');
      queueConnection.publish(config.rabbitmq.emailsQueue, message, publishOptions, function(err) {
        if (err) {
          console.error('emails->Failed to put email to queue.');
          return reject(new Error('Failed to put email to queue.'));
        }
        console.log('emails->Pushed message to queue.');
        resolve();
      });
    });
*/
  });
};
