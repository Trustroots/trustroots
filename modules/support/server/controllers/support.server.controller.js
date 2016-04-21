'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    config = require(path.resolve('./config/config')),
    nodemailer = require('nodemailer'),
    validator = require('validator'),
    async = require('async');

// Replace mailer with Stub mailer transporter
// Stub transport does not send anything, it builds the mail stream into a single Buffer and returns
// it with the sendMail callback. This is useful for testing the emails before actually sending anything.
// @link https://github.com/andris9/nodemailer-stub-transport
if (process.env.NODE_ENV === 'test') {
  var stubTransport = require('nodemailer-stub-transport');
  config.mailer.options = stubTransport();
}

/**
 * Send support request to our support systems
 */
exports.supportRequest = function(req, res) {
  async.waterfall([

    // Prepare TEXT email
    function(done) {

      var renderVars = {
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
      };

      res.render(
        path.resolve('./modules/core/server/views/email-templates-text/support-request'),
        renderVars,
        function(err, emailPlain) {
          done(err, emailPlain, renderVars);
        });
    },

    // If valid email, send reset email using service
    function(emailPlain, renderVars, done) {
      var smtpTransport = nodemailer.createTransport(config.mailer.options);

      var fromMail = {
        // Trust registered user's email, otherwise validate it
        // Default to TO-support email
        address: (req.user || validator.isEmail(renderVars.email)) ? renderVars.email : config.supportEmail
      };

      // Add name to sender if we have it
      if(req.user) {
        fromMail.name = req.user.displayName;
      }

      var mailOptions = {
        from: 'Trustroots Support <' + config.supportEmail + '>',
        to: 'Trustroots Support <' + config.supportEmail + '>',
        replyTo: fromMail,
        subject: 'Support request',
        text: emailPlain
      };

      smtpTransport.sendMail(mailOptions, function(err) {
        smtpTransport.close(); // close the connection pool
        if (!err) {
          return res.json({message: 'Support request sent.'});
        } else {
          return res.status(400).send({
            message: 'Failure while sending your support request. Please try again.'
          });
        }
      });
    }
  ], function(err) {
    if(err) {
      console.error('Support request error:');
      console.error(err);
      return res.status(400).send({
        message: 'Failure while sending your support request. Please try again.'
      });
    }
  });
};
