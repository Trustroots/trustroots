'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    config = require(path.resolve('./config/config')),
    validator = require('validator');

/**
 * Send support request to our support systems
 */
exports.supportRequest = function(req, res) {

  // Prepare support request variables for the email template
  var supportRequest = {
    /* eslint-disable key-spacing */
    message:       (req.body.message) ? textProcessor.plainText(req.body.message) : '—',
    username:      (req.user) ? req.user.username : textProcessor.plainText(req.body.username),
    email:         (req.user) ? req.user.email : textProcessor.plainText(req.body.email),
    emailTemp:     (req.user && req.user.emailTemporary) ? req.user.emailTemporary : false,
    displayName:   (req.user) ? req.user.displayName : '-',
    userId:        (req.user) ? req.user._id.toString() : '-',
    userAgent:     (req.headers && req.headers['user-agent']) ? textProcessor.plainText(req.headers['user-agent']) : '—',
    authenticated: (req.user) ? 'yes' : 'no',
    profilePublic: (req.user && req.user.public) ? 'yes' : 'no',
    signupDate:    (req.user) ? req.user.created.toString() : '-',
    reportMember:  (req.body.reportMember) ? textProcessor.plainText(req.body.reportMember) : false
    /* eslint-enable key-spacing */
  };

  var replyTo = {
    // Trust registered user's email, otherwise validate it
    // Default to TO-support email
    address: (req.user || validator.isEmail(supportRequest.email)) ? supportRequest.email : config.supportEmail
  };

  // Add name to sender if we have it
  if (req.user) {
    replyTo.name = req.user.displayName;
  }

  // Send email
  emailService.sendSupportRequest(replyTo, supportRequest, function(err) {
    if (err) {
      console.error('Support request error:');
      console.error(err);
      return res.status(400).send({
        message: 'Failure while sending your support request. Please try again.'
      });
    }

    return res.json({
      message: 'Support request sent.'
    });
  });

};
