/**
 * Unit tests for uncovered finish-signup job error paths.
 */
const sinon = require('sinon');
const mongoose = require('mongoose');
const moment = require('moment');

const emailService = require('../../../../core/server/services/email.server.service');
const userFinishSignupJobHandler = require('../../../server/jobs/user-finish-signup.server.job');
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
