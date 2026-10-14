const mongoose: typeof import('mongoose') = require('mongoose');
const testutils: typeof import('../../../../../testutils/server/server.testutil.mts') = require('../../../../../testutils/server/server.testutil');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
require('should');

type EmailData = {
  to: { name: string; address: string };
  from: string;
  subject: string;
  html: string;
  text: string;
};
type EmailJob = {
  attrs: { _id: import('mongoose').Types.ObjectId; data: EmailData };
};
type JobCallback = (error?: Error | null) => void;
type SendEmailJobHandler = (job: EmailJob, callback: JobCallback) => void;

/**
 * Globals
 */
let sendEmailJobHandler: SendEmailJobHandler;

describe('job: send email', function () {
  const sentEmails = testutils.catchEmails();

  before(function () {
    sendEmailJobHandler = require('./../../../server/jobs/send-email.server.job.mjs');
  });

  it('reports send failures', function (done) {
    const config: typeof import('../../../../../config/config.mjs').default = require('./../../../../../config/config.mjs');
    const originalSend = config.mailer.options.send;
    config.mailer.options.send = function (
      data: EmailData,
      callback: JobCallback,
    ) {
      callback(new Error('smtp failed'));
    };

    const job = {
      attrs: {
        _id: new mongoose.Types.ObjectId(),
        data: {
          to: {
            name: 'foo',
            address: 'to@test.com',
          },
          from: 'from@test.com',
          subject: 'test subject',
          html: 'html content',
          text: 'text content',
        },
      },
    };

    sendEmailJobHandler(job, function (err?: Error | null) {
      config.mailer.options.send = originalSend;
      err!.should.be.Error();
      sentEmails.length.should.equal(0);
      done();
    });
  });

  it('will send an email', function (done) {
    const job = {
      attrs: {
        _id: new mongoose.Types.ObjectId(),
        data: {
          to: {
            name: 'foo',
            address: 'to@test.com',
          },
          from: 'from@test.com',
          subject: 'test subject',
          html: 'html content',
          text: 'text content',
        },
      },
    };
    sendEmailJobHandler(job, function (err?: Error | null) {
      if (err) return done(err);
      sentEmails.length.should.equal(1);
      const sentEmail = sentEmails[0];
      assert.ok(sentEmail);
      assert.equal(sentEmail.data.subject, job.attrs.data.subject);
      assert.equal(sentEmail.data.html, job.attrs.data.html);
      assert.equal(sentEmail.data.text, job.attrs.data.text);
      done();
    });
  });
});
