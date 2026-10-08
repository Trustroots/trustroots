/**
 * Unit tests for uncovered finish-signup job error paths.
 */
const sinon = require('sinon');
const mongoose = require('mongoose');
const moment = require('moment');

const emailService = require('./../../../../core/server/services/email.server.service.mjs');
const userFinishSignupJobHandler = require('./../../../server/jobs/user-finish-signup.server.job.mjs');
const testutils = require('../../../../../testutils/server/server.testutil');
require('should');

const User = mongoose.model('User');

describe('Job: user finish signup unit tests', () => {
  const jobs = testutils.catchJobs();
  let unConfirmedUser;

  beforeEach(function (done) {
    unConfirmedUser = new User({
      public: false,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'finish-signup-unit@test.com',
      emailTemporary: 'finish-signup-unit@test.com',
      emailToken: 'initial email token',
      username: 'finish_signup_unit',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      created: moment().subtract(moment.duration({ hours: 4 })),
    });

    unConfirmedUser.save(done);
  });

  afterEach(function (done) {
    sinon.restore();
    User.deleteMany().exec(done);
  });

  it('passes lookup errors to agenda', function (done) {
    sinon.stub(User, 'find').returns({
      and: () => ({
        limit: () => ({
          exec: cb => cb(new Error('lookup failed')),
        }),
      }),
    });

    userFinishSignupJobHandler(
      { attrs: { _id: new mongoose.Types.ObjectId() } },
      function (err) {
        err.message.should.equal('lookup failed');
        jobs.length.should.equal(0);
        done();
      },
    );
  });

  it('does not send a reminder when persisting its fresh token fails', function (done) {
    sinon
      .stub(User, 'updateOne')
      .callsFake((query, update, callback) =>
        callback(new Error('token persistence failed')),
      );
    const send = sinon.spy(emailService, 'sendSignupEmailReminder');
    userFinishSignupJobHandler(
      { attrs: { _id: new mongoose.Types.ObjectId() } },
      function (err) {
        err.message.should.equal('token persistence failed');
        send.called.should.be.false();
        jobs.length.should.equal(0);
        done();
      },
    );
  });

  for (const change of [
    { public: true },
    { emailToken: 'newer-confirmation-token' },
  ]) {
    it(
      'skips a reminder whose member state changed after lookup: ' +
        Object.keys(change)[0],
      function (done) {
        const originalUpdate = User.updateOne.bind(User);
        sinon.stub(User, 'updateOne').callsFake((query, update, callback) => {
          originalUpdate({ _id: unConfirmedUser._id }, { $set: change })
            .then(() => originalUpdate(query, update))
            .then(result => callback(null, result), callback);
        });
        const send = sinon.spy(emailService, 'sendSignupEmailReminder');
        userFinishSignupJobHandler(
          { attrs: { _id: new mongoose.Types.ObjectId() } },
          function (err) {
            if (err) return done(err);
            send.called.should.be.false();
            jobs.length.should.equal(0);
            done();
          },
        );
      },
    );
  }

  it('passes email send errors to agenda', function (done) {
    sinon
      .stub(emailService, 'sendSignupEmailReminder')
      .callsFake((user, cb) => cb(new Error('mail failed')));

    userFinishSignupJobHandler(
      { attrs: { _id: new mongoose.Types.ObjectId() } },
      function (err) {
        err.message.should.equal('mail failed');
        jobs.length.should.equal(0);
        done();
      },
    );
  });
});
