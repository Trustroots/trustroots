const mongoose = require('mongoose');
const testutils = require('../../../../../testutils/server/server.testutil');
require('should');

/**
 * Globals
 */
let sendEmailJobHandler;

describe('job: send email', function () {
  const sentEmails = testutils.catchEmails();

  before(function () {
    sendEmailJobHandler = require('../../../server/jobs/send-email.server.job');
  });

  it('reports send failures', function (done) {
    const config = require('../../../../../config/config');
    const originalSend = config.mailer.options.send;
    config.mailer.options.send = function (data, callback) {
      callback(new Error('smtp failed'));
    };

    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
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

    sendEmailJobHandler(job, function (err) {
      config.mailer.options.send = originalSend;
      err.should.be.Error();
      sentEmails.length.should.equal(0);
      done();
    });
  });

  it('will send an email', function (done) {
    const job = {
      attrs: {
        // eslint-disable-next-line new-cap
        _id: mongoose.Types.ObjectId(),
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
    sendEmailJobHandler(job, function (err) {
      if (err) return done(err);
      sentEmails.length.should.equal(1);
      sentEmails[0].data.subject.should.equal(job.attrs.data.subject);
      sentEmails[0].data.html.should.equal(job.attrs.data.html);
      sentEmails[0].data.text.should.equal(job.attrs.data.text);
      done();
    });
  });
});
