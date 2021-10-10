const path = require('path');
const mongoose = require('mongoose');
const testutils = require(path.resolve('./testutils/server/server.testutil'));

/**
 * Globals
 */
let sendEmailJobHandler;

describe('job: send email', () => {
  const sentEmails = testutils.catchEmails();

  before(function () {
    sendEmailJobHandler = require(path.resolve(
      './modules/core/server/jobs/send-email.server.job',
    ));
  });

  it('will send an email', done => {
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
    sendEmailJobHandler(job, err => {
      if (err) {
        return done(err);
      }
      sentEmails.length.should.equal(1);
      sentEmails[0].data.subject.should.equal(job.attrs.data.subject);
      sentEmails[0].data.html.should.equal(job.attrs.data.html);
      sentEmails[0].data.text.should.equal(job.attrs.data.text);
      done();
    });
  });
});
