/**
 * Generate eml files out of all Trustroots email templates,
 * so that you can open them for inspection with email clients.
 *
 * Usage:
 * NODE_ENV=test node ./scripts/exportEmailsAsEml.js
 *
 * To set temp directory:
 * NODE_ENV=test node ./scripts/exportEmailsAsEml.js /path/to/files
 *
 * By default stores them to `./tmp/renderedEmails`
 */

var path = require('path'),
    fs = require('fs'),
    del = require('del'),
    mkdirRecursive = require('mkdir-recursive'),
    async = require('async'),
    chalk = require('chalk'),
    nodemailer = require('nodemailer'),
    config = require(path.resolve('./config/config')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service'));

// Default temp folder
var tempFolder = (process.argv[2] == null) ? path.resolve('./tmp/renderedEmails') : process.argv[2];

var transport = nodemailer.createTransport({streamTransport:true, buffer:true});

// Initialize script
writeEmails();

function writeEml(templateName, params, callback) {
  // Add all missing params
  var params = generateParams(params);
  // Render the email template
  console.log('');
  console.log('Generate "' + templateName + '"');
  emailService.renderEmail(templateName, params, function(err, email) {
    if (err) {
      console.error(' -> Failed to render:');
      console.error(err);
      return callback(err);
    }
    console.log(' -> Rendered');
    transport.sendMail(email, function(err, info) {
      if (err) {
        console.error(' -> Failed sending email to stub transport:');
        console.error(err);
        return callback(err);
      }

      var eml = info.message.toString();
      var filename = templateName + '.eml';

      // Store eml file to `tempFolder`
      fs.writeFile(tempFolder + '/' + filename, eml, function(err) {
        if (err) {
          console.error(' -> Failed writing to ' + filename);
          console.error(err);
          return callback(err);
        }
        console.log(' -> Saved to ' + filename);
        callback();
      });
    });
  });
}

function writeEmails() {
  console.log('---');
  console.log(chalk.green('Generating eml files out of emails.'));
  console.log('Storing them to "' + tempFolder + '"');

  // Send emails
  async.waterfall([
      ensureTempDir,
      emptyTempDir,

      // Generate emails:
      generateMessagesUnread,
      generateConfirmContact,
      generateResetPassword,
      generateResetPasswordConfirm,
      generateChangeEmailConfirmation,
      generateSignupEmailConfirmation,
      generateSupportRequest,
      generateSignupEmailReminder,
      generateReactivateHosts
  ], function (err) {
    if (err) {
      console.error(err);
      return;
    }
    console.log();
    console.log(chalk.green('Done!'));
    console.log('See files from ' + tempFolder);
    console.log(chalk.white('')); // Reset to white
    process.exit(0);
  });
}

function generateParams(params) {
  // Add these...
  params.utmCampaign = 'transactional-email';
  params.subject = 'Transactional email';
  params.firstName = 'Joe';
  params.name = 'Joe Doe';
  params.email = 'test@test.com';
  params.emailTemporary = 'test@test.com';
  params.emailToken = 'emailtoken';
  params.urlConfirmPlainText = 'https://www.trustroots.org/';
  params.urlConfirm = 'https://www.trustroots.org/';

  // Then add some more...
  return emailService.addEmailBaseTemplateParams(params);
}

// Ensure temp directory exists
function ensureTempDir(done) {
  console.log('Ensuring temp directory exists.');
  mkdirRecursive.mkdir(tempFolder, function(err) {
    if (err && err.code !== 'EEXIST') {
      console.error(err);
    }
    done(err);
  });
}

function emptyTempDir(done) {
  console.log('Emptying temp directory from *.eml files.');
  del([ tempFolder + '/*.eml' ]);
  done();
}


// Emails

function generateMessagesUnread(done) {
  var message = {
    userFrom: '57b1bc2510e727072793e5c7',
    userTo: '56cf612e1a2de3a50b1fe7bf',
    created: new Date(),
    content: 'Lorem ipsum dolor sit amet, consectetuer adipiscing eli. \
      Sed posuere interdum sem. Quisque ligula eros ullamcorper vitae, \
      lacinia quis facilisis sed sapien. Mauris varius diam vitae acu. \
      Sed arcu lectus auctor vitae, consectetuer et venenatis eg veit. \
      Sed augue orci, lacinia eu tincdunt et eleifend nec lacus. Donec \
      ultricies nisl ut felis, suspendisse potenti. Lorem ipsum ligula \
      hendrerit mollis, ipsum erat vehicula risus, eu susit sem libero \
      nec erat. Aliquam erat volutpat. Sed congue augue vitae neque.'
  };
  writeEml(
    'messages-unread',
    {
      mailTitle: 'mailSubject',
      messageCount: 4,
      messages: [ message, message, message, message ],
      userFromName: 'Anna',
      userToName: 'Joe',
      urlReplyPlainText: '#',
      urlReply: '#',
      urlUserFromProfilePlainText: '#',
      urlUserFromProfile: '#'
    },
    done
  );
}

function generateConfirmContact(done) {
  writeEml(
    'confirm-contact',
    {
      messageHTML: '<p>Lorem <b>ipsum</b></p>',
      messageText: 'Lorem ipsum',
      meName: 'Joe',
      meURLPlainText: '#',
      meURL: '#'
    },
    done
  );
}

function generateResetPassword(done) {
  writeEml(
    'reset-password',
    {  },
    done
  );
}

function generateResetPasswordConfirm(done) {
  writeEml(
    'reset-password-confirm',
    { },
    done
  );
}

function generateChangeEmailConfirmation(done) {
  writeEml(
    'email-confirmation',
    { },
    done
  );
}

function generateSignupEmailConfirmation(done) {
  writeEml(
    'signup',
    { },
    done
  );
}

function generateSupportRequest(done) {
  writeEml(
    'support-request',
    {
      from: 'Trustroots Support <' + config.supportEmail + '>',
      name: 'Trustroots Support', // `To:`
      email: config.supportEmail, // `To:`
      replyTo: config.supportEmail,
      subject: 'Support request',
      request: 'Lorem ipsum dolor sit amet?',
      skipHtmlTemplate: true // Don't render html template for this email
    },
    done
  );
}

function generateSignupEmailReminder(done) {
  writeEml(
    'signup-reminder',
    { },
    done
  );
}

function generateReactivateHosts(done) {
  writeEml(
    'reactivate-hosts',
    {
      urlOfferPlainText: '#',
      urlOffer: '#',
      urlSurveyPlainText: '#',
      urlSurvey: '#',
    },
    done
  );
}
