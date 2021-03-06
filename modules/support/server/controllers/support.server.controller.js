/**
 * Module dependencies.
 */
const path = require('path');
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const log = require(path.resolve('./config/lib/logger'));
const config = require(path.resolve('./config/config'));
const mongoose = require('mongoose');
const SupportRequest = mongoose.model('SupportRequest');
const validator = require('validator');

/**
 * Send support request to our support systems
 */
exports.supportRequest = function (req, res) {
  // Prepare support request variables for the email template
  const supportRequestData = {
    /* eslint-disable key-spacing */
    message: req.body.message ? textService.plainText(req.body.message) : '—',
    username: req.user
      ? req.user.username
      : textService.plainText(req.body.username),
    email: req.user ? req.user.email : textService.plainText(req.body.email),
    emailTemp:
      req.user && req.user.emailTemporary ? req.user.emailTemporary : false,
    displayName: req.user ? req.user.displayName : '-',
    userId: req.user ? req.user._id.toString() : '-',
    userAgent:
      req.headers && req.headers['user-agent']
        ? textService.plainText(req.headers['user-agent'])
        : '—',
    authenticated: req.user ? 'yes' : 'no',
    profilePublic: req.user && req.user.public ? 'yes' : 'no',
    signupDate: req.user ? req.user.created.toString() : '-',
    reportMember: req.body.reportMember
      ? textService.plainText(req.body.reportMember)
      : false,
    /* eslint-enable key-spacing */
  };

  const replyTo = {
    // Trust registered user's email, otherwise validate it
    // Default to TO-support email
    address:
      req.user || validator.isEmail(supportRequestData.email)
        ? supportRequestData.email
        : config.supportEmail,
  };

  // Add name to sender if we have it
  if (req.user) {
    replyTo.name = req.user.displayName;
  }

  // Backup support request for storing it to db
  const storedSupportRequestData = {
    userAgent: supportRequestData.userAgent,
    username: supportRequestData.username,
    email: supportRequestData.email,
    message: supportRequestData.message,
  };
  if (req.user) {
    storedSupportRequestData.user = req.user._id;
  }
  if (supportRequestData.reportMember) {
    storedSupportRequestData.reportMember = supportRequestData.reportMember;
  }

  const supportRequest = new SupportRequest(storedSupportRequestData);

  // Save support request to db
  supportRequest.save(function (dbErr) {
    if (dbErr) {
      log('error', 'Failed storing support request to the DB. #39ghsa', {
        error: dbErr,
      });
    }

    // Send email
    emailService.sendSupportRequest(
      replyTo,
      supportRequestData,
      function (emailServiceErr) {
        if (emailServiceErr) {
          log('error', 'Failed sending support request via email. #49ghsd', {
            error: emailServiceErr,
          });

          return res.status(400).send({
            message:
              'Failure while sending your support request. Please try again.',
          });
        }

        res.json({
          message: 'Support request sent.',
        });

        const statsObject = {
          namespace: 'supportRequest',
          counts: {
            count: 1,
          },
          tags: {
            authenticated: supportRequestData.authenticated,
            type: supportRequestData.reportMember ? 'reportMember' : 'normal',
          },
        };

        statService.stat(statsObject, function () {
          log(
            'info',
            'Support request processed and recorded to stats. #2hfsgh',
          );
        });
      },
    );
  });
};
