import sinon from 'sinon';
import mongoose, { type HydratedDocument } from 'mongoose';
import { sub } from 'date-fns';
import emailService from './../../../../core/server/services/email.server.service.mts';
import userFinishSignupJobHandler from './../../../server/jobs/user-finish-signup.server.job.mts';
import * as testutils from '../../../../../testutils/server/server.testutil.mts';
import 'should';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import config from '../../../../../config/config.mts';
import sendEmailJob from '../../../../core/server/jobs/send-email.server.job.mts';
import type { RenderedEmail } from '../../../../core/server/services/email.server.service.mts';
import type { UserServerRecord } from '../../../server/models/user.server.types.mts';

const User = mongoose.model<UserServerRecord>('User');
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  if (value === null || value === undefined)
    throw new Error('Expected an error');
}
describe('Job: user finish signup unit tests', () => {
  const jobs = testutils.catchJobs<RenderedEmail>();
  const emails = testutils.catchEmails();
  const attrs = () => ({ _id: new mongoose.Types.ObjectId() });
  const run = () => promisify(userFinishSignupJobHandler)({ attrs: attrs() });
  const deliver = async () => {
    const data = jobs[0]?.data;
    assert.ok(data);
    await promisify(sendEmailJob)({
      attrs: { ...attrs(), data },
    });
  };
  let unConfirmedUser: HydratedDocument<UserServerRecord>;
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
      created: sub(new Date(), { hours: 4 }),
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
      exec() {
        return Promise.reject(new Error('lookup failed'));
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
  it('keeps the previous link and reminder count when SMTP fails', async () => {
    const options = config.mailer.options;
    sinon.stub(config.mailer, 'options').value({
      ...options,
      send: (_mail: unknown, done: (error: Error) => void) =>
        done(new Error('smtp failed')),
    });

    await run();
    await assert.rejects(deliver(), /smtp failed/);
    assert.equal(emails.length, 0);

    const member = await User.findById(unConfirmedUser._id);
    assert.ok(member);
    assert.equal(member.emailToken, unConfirmedUser.emailToken);
    assert.deepEqual(
      member.emailTokenIssuedAt,
      unConfirmedUser.emailTokenIssuedAt,
    );
    assert.deepEqual(
      member.emailTokenExpires,
      unConfirmedUser.emailTokenExpires,
    );
    assert.equal(
      member.publicReminderCount,
      unConfirmedUser.publicReminderCount,
    );
    assert.equal(member.publicReminderSent, unConfirmedUser.publicReminderSent);
  });

  for (const change of [
    { public: true },
    { emailToken: 'newer-confirmation-token' },
    { emailTemporary: 'newer-pending-address@example.test' },
    { emailTokenIssuedAt: new Date(0) },
    { emailTokenExpires: new Date(0) },
    { roles: ['suspended'] },
  ]) {
    it(
      'skips a queued reminder after ' + Object.keys(change)[0] + ' changes',
      async () => {
        await run();
        await User.updateOne({ _id: unConfirmedUser._id }, { $set: change });
        await deliver();
        assert.equal(emails.length, 0);
      },
    );
  }

  it('does not deliver a queued reminder without a recipient', async () => {
    await run();
    const data = jobs[0]?.data;
    assert.ok(data);
    data.to.address = undefined;

    await deliver();
    assert.equal(emails.length, 0);
  });

  it('keeps a newer token issued during SMTP delivery', async () => {
    await run();
    const options = config.mailer.options;
    sinon.stub(config.mailer, 'options').value({
      ...options,
      send: (_mail: unknown, done: (error?: unknown) => void) => {
        User.updateOne(
          { _id: unConfirmedUser._id },
          { $set: { emailToken: 'newer-confirmation-token' } },
        ).then(() => done(), done);
      },
    });

    await deliver();
    const member = await User.findById(unConfirmedUser._id);
    assert.ok(member);
    assert.equal(member.emailToken, 'newer-confirmation-token');
    assert.equal(
      member.publicReminderCount,
      unConfirmedUser.publicReminderCount,
    );
  });

  it('passes email queue errors to agenda', async () => {
    sinon
      .stub(emailService, 'sendSignupEmailReminder')
      .callsFake((user, cb) => cb(new Error('queue failed')));
    await assert.rejects(run(), /queue failed/);
    assert.equal(jobs.length, 0);
  });
});
