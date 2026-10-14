/**
 * Unit tests for uncovered finish-signup job error paths.
 */
import type {
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';
const sinon: typeof import('sinon') = require('sinon');
const mongoose: typeof import('mongoose') = require('mongoose');
const moment: typeof import('moment') = require('moment');
const emailService: typeof import('../../../../core/server/services/email.server.service.mjs').default = require('./../../../../core/server/services/email.server.service.mjs');
const userFinishSignupJobHandler: typeof import('../../../server/jobs/user-finish-signup.server.job.mjs').default = require('./../../../server/jobs/user-finish-signup.server.job.mjs');
const testutils: typeof import('../../../../../testutils/server/server.testutil.mts') = require('../../../../../testutils/server/server.testutil');
require('should');
const User = mongoose.model<UserRecord, UserModel>('User');
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  if (value === null || value === undefined)
    throw new Error('Expected an error');
}
describe('Job: user finish signup unit tests', () => {
  const jobs = testutils.catchJobs();
  let unConfirmedUser: UserModelDocument;
  beforeEach(function (done) {
    unConfirmedUser = new User({
      public: false,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'finish-signup-unit@test.com',
      emailTemporary: 'finish-signup-unit@test.com',
      emailToken: 'initial email token',
      emailTokenIssuedAt: new Date(),
      emailTokenExpires: new Date(Date.now() + 86400000),
      username: 'finishsignupunit',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      created: moment().subtract(moment.duration({ hours: 4 })),
    });
    unConfirmedUser
      .save()
      .then(() => done())
      .catch(done);
  });
  afterEach(function (done) {
    sinon.restore();
    User.deleteMany()
      .exec()
      .then(() => done())
      .catch(done);
  });
  it('passes lookup errors to agenda', function (done) {
    const fakeQuery = {
      and() {
        return this;
      },
      limit() {
        return this;
      },
      exec(callback: (error: Error | null) => void) {
        callback(new Error('lookup failed'));
      },
    };
    sinon
      .stub(User, 'find')
      .returns(fakeQuery as unknown as ReturnType<typeof User.find>);
    userFinishSignupJobHandler(
      { attrs: { _id: new mongoose.Types.ObjectId() } },
      function (err?: Error | null) {
        assertPresent(err);
        err.message.should.equal('lookup failed');
        jobs.length.should.equal(0);
        done();
      },
    );
  });
  it('does not send a reminder when persisting its fresh token fails', function (done) {
    sinon
      .stub(User, 'updateOne')
      .rejects(new Error('token persistence failed'));
    const send = sinon.spy(emailService, 'sendSignupEmailReminder');
    userFinishSignupJobHandler(
      { attrs: { _id: new mongoose.Types.ObjectId() } },
      function (err?: Error | null) {
        assertPresent(err);
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
    { emailTemporary: 'newer-pending-address@example.test' },
  ]) {
    it(
      'skips a reminder whose member state changed after lookup: ' +
        Object.keys(change)[0],
      function (done) {
        const originalUpdate = User.updateOne.bind(User);
        const updateStub = sinon.stub(
          User,
          'updateOne',
        ) as unknown as import('sinon').SinonStub<
          Parameters<
            import('../../../../../testutils/server/model-contracts.mts').UserUpdateOne
          >,
          ReturnType<
            import('../../../../../testutils/server/model-contracts.mts').UserUpdateOne
          >
        >;
        updateStub.callsFake((query, update) => {
          return originalUpdate(
            { _id: unConfirmedUser._id },
            { $set: change },
          ).then(() => originalUpdate(query, update)) as unknown as ReturnType<
            typeof User.updateOne
          >;
        });
        const send = sinon.spy(emailService, 'sendSignupEmailReminder');
        userFinishSignupJobHandler(
          { attrs: { _id: new mongoose.Types.ObjectId() } },
          function (err?: Error | null) {
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
      function (err?: Error | null) {
        assertPresent(err);
        err.message.should.equal('mail failed');
        jobs.length.should.equal(0);
        done();
      },
    );
  });
});
