import type { Done, Result } from './legacy-cli-contracts.d.cts';
import type {
  EmailTemplateParams,
  RenderedEmail,
} from '../modules/core/server/services/email.server.service.mts';
type TemplateName =
  | 'messages-unread'
  | 'confirm-contact'
  | 'reset-password'
  | 'reset-password-confirm'
  | 'email-confirmation'
  | 'signup'
  | 'support-request'
  | 'signup-reminder'
  | 'reactivate-hosts';
type TemplateParams = EmailTemplateParams;
interface StreamMailer {
  createTransport(options: { streamTransport: true; buffer: true }): {
    sendMail(email: RenderedEmail, callback: Result<{ message: Buffer }>): void;
  };
}
interface TemplateAsync {
  waterfall(tasks: Array<(callback: Done) => void>, callback: Done): void;
}
/**
 * Generate eml files out of all Trustroots email templates,
 * so that you can open them for inspection with email clients.
 *
 * Usage:
 * NODE_ENV=test node ./scripts/exportEmailsAsEml.cts
 *
 * To set temp directory:
 * NODE_ENV=test node ./scripts/exportEmailsAsEml.cts /path/to/files
 *
 * By default stores them to `./tmp/renderedEmails`
 */

const path = require('node:path') as typeof import('node:path');
const fs = require('node:fs') as typeof import('node:fs');
const removeLocalPath =
  require('../modules/core/server/services/file-removal.server.service.mjs')
    .removeLocalPath as (filename: string) => Promise<void>;
const async = require('async') as TemplateAsync;
const nodemailer = require('nodemailer') as StreamMailer;
const config = require('./../config/config.mjs') as { supportEmail: string };
const emailService =
  require('./../modules/core/server/services/email.server.service.mjs') as typeof import('../modules/core/server/services/email.server.service.mts').default;

// Default temp folder
const tempFolder =
  process.argv[2] == null
    ? path.resolve('./tmp/renderedEmails')
    : process.argv[2];

const transport = nodemailer.createTransport({
  streamTransport: true,
  buffer: true,
});

// Initialize script
writeEmails();

function writeEml(
  templateName: TemplateName,
  params: TemplateParams,
  callback: Done,
) {
  // Add all missing params
  params = generateParams(params);
  // Render the email template
  console.log('');
  console.log('Generate "' + templateName + '"');
  emailService.renderEmail(templateName, params, function (err, email) {
    if (err) {
      console.error(' -> Failed to render:');
      console.error(err);
      return callback(err);
    }
    console.log(' -> Rendered');
    transport.sendMail(email!, function (err, info) {
      if (err) {
        console.error(' -> Failed sending email to stub transport:');
        console.error(err);
        return callback(err);
      }

      const eml = info.message.toString();
      const filename = templateName + '.eml';

      // Store eml file to `tempFolder`
      fs.writeFile(tempFolder + '/' + filename, eml, function (err) {
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
  console.log('Generating eml files out of emails.');
  console.log('Storing them to "' + tempFolder + '"');

  // Send emails
  async.waterfall(
    [
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
      generateReactivateHosts,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return;
      }
      console.log();
      console.log('Done!');
      console.log('See files from ' + tempFolder);
      process.exit(0);
    },
  );
}

function generateParams(params: TemplateParams): TemplateParams {
  // Add these...
  params.utmCampaign = 'transactional-email';
  params.subject = 'Transactional email';
  params.firstName = 'Joe';
  params.name = 'Joe Doe';
  params.email = 'member@example.test';
  params.emailTemporary = 'member@example.test';
  params.emailToken = 'emailtoken';
  params.urlConfirmPlainText = 'https://www.trustroots.org/';
  params.urlConfirm = 'https://www.trustroots.org/';

  // Then add some more...
  return emailService.addEmailBaseTemplateParams(params);
}

// Ensure temp directory exists
function ensureTempDir(done: Done) {
  console.log('Ensuring temp directory exists.');
  fs.mkdir(tempFolder, { recursive: true }, function (err) {
    if (err && err.code !== 'EEXIST') {
      console.error(err);
    }
    done(err);
  });
}

function emptyTempDir(done: Done) {
  console.log('Emptying temp directory from *.eml files.');
  fs.promises
    .readdir(tempFolder)
    .then(names =>
      Promise.all(
        names
          .filter(name => !name.startsWith('.') && name.endsWith('.eml'))
          .map(name => removeLocalPath(path.join(tempFolder, name))),
      ),
    )
    .then(() => done(), done);
}

// Emails

function generateMessagesUnread(done: Done) {
  const message = {
    userFrom: '000000000000000000000011',
    userTo: '000000000000000000000022',
    created: new Date(),
    content:
      'Lorem ipsum dolor sit amet, consectetuer adipiscing eli. \
      Sed posuere interdum sem. Quisque ligula eros ullamcorper vitae, \
      lacinia quis facilisis sed sapien. Mauris varius diam vitae acu. \
      Sed arcu lectus auctor vitae, consectetuer et venenatis eg veit. \
      Sed augue orci, lacinia eu tincdunt et eleifend nec lacus. Donec \
      ultricies nisl ut felis, suspendisse potenti. Lorem ipsum ligula \
      hendrerit mollis, ipsum erat vehicula risus, eu susit sem libero \
      nec erat. Aliquam erat volutpat. Sed congue augue vitae neque.',
  };
  writeEml(
    'messages-unread',
    {
      mailTitle: 'mailSubject',
      messageCount: 4,
      messages: [message, message, message, message],
      userFromName: 'Anna',
      userToName: 'Joe',
      urlReplyPlainText: '#',
      urlReply: '#',
      urlUserFromProfilePlainText: '#',
      urlUserFromProfile: '#',
    },
    done,
  );
}

function generateConfirmContact(done: Done) {
  writeEml(
    'confirm-contact',
    {
      messageHTML: '<p>Lorem <b>ipsum</b></p>',
      messageText: 'Lorem ipsum',
      meName: 'Joe',
      meURLPlainText: '#',
      meURL: '#',
    },
    done,
  );
}

function generateResetPassword(done: Done) {
  writeEml('reset-password', {}, done);
}

function generateResetPasswordConfirm(done: Done) {
  writeEml('reset-password-confirm', {}, done);
}

function generateChangeEmailConfirmation(done: Done) {
  writeEml('email-confirmation', {}, done);
}

function generateSignupEmailConfirmation(done: Done) {
  writeEml('signup', {}, done);
}

function generateSupportRequest(done: Done) {
  writeEml(
    'support-request',
    {
      from: 'Trustroots Support <' + config.supportEmail + '>',
      name: 'Trustroots Support', // `To:`
      email: config.supportEmail, // `To:`
      replyTo: config.supportEmail,
      subject: 'Support request',
      request: 'Lorem ipsum dolor sit amet?',
      skipHtmlTemplate: true, // Don't render html template for this email
    },
    done,
  );
}

function generateSignupEmailReminder(done: Done) {
  writeEml('signup-reminder', {}, done);
}

function generateReactivateHosts(done: Done) {
  writeEml(
    'reactivate-hosts',
    {
      urlOfferPlainText: '#',
      urlOffer: '#',
      urlSurveyPlainText: '#',
      urlSurvey: '#',
    },
    done,
  );
}
