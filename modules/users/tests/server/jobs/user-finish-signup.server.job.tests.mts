import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import createSendEmailJob from '../../../../core/server/jobs/send-email.server.job.mts';
import { canDeliverNotificationEmail } from '../../../server/services/notification-email.server.service.mts';
import { deliverSignupReminder } from '../../../server/services/signup-reminder.server.service.mts';
import type { RenderedEmail } from '../../../../core/server/services/email.server.service.mts';
import { emailConfirmationTokenQuery } from '../../../server/services/email-confirmation.server.service.mts';
import runSignupReminders from '../../../server/jobs/user-finish-signup.server.job.mts';
import should from 'should';
import * as testutils from '../../../../../testutils/server/server.testutil.mts';
import config from './../../../../../config/config.mts';
import { sub } from 'date-fns';
import mongoose, { type HydratedDocument } from 'mongoose';
/**
 * Module dependencies.
 */
import type { UserRecord } from '../../../../../testutils/server/model-contracts.mts';

interface SignupReminderUser extends Omit<
  UserRecord,
  'created' | 'emailTokenIssuedAt' | 'emailTokenExpires'
> {
  created?: Date;
  publicReminderCount?: number;
  publicReminderSent?: Date;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
}
type SignupReminderDocument = HydratedDocument<SignupReminderUser>;
type SignupReminderMail = RenderedEmail & {
  subject: string;
  html: string;
  to: { address: string };
};
const User = mongoose.model<SignupReminderUser>('User');

/**
 * Globals
 */
let unConfirmedUser: SignupReminderDocument;
let _unConfirmedUser: SignupReminderUser;
let confirmedUser: SignupReminderDocument;
let _confirmedUser: SignupReminderUser;

function saveWithCallback(
  document: SignupReminderDocument,
  callback: (error?: Error | null) => void,
): void {
  void document.save().then(
    () => callback(),
    error =>
      callback(error instanceof Error ? error : new Error(String(error))),
  );
}

function findUserByEmail(
  email: string,
  callback: (error: Error | null, user?: SignupReminderDocument) => void,
): void {
  void User.findOne({ email })
    .exec()
    .then(user => {
      if (!user) {
        throw new Error(`Expected test user ${email} to exist`);
      }
      callback(null, user);
    })
    .catch(error =>
      callback(error instanceof Error ? error : new Error(String(error))),
    );
}

describe('Job: user finish signup', function () {
  const jobs = testutils.catchJobs<SignupReminderMail>();
  testutils.catchEmails();
  let delivered = 0;
  beforeEach(() => {
    delivered = 0;
  });

  const userFinishSignupJobHandler: typeof runSignupReminders = (job, done) => {
    async function runAndDeliver() {
      await promisify(runSignupReminders)(job);
      for (const { data } of jobs.slice(delivered)) {
        await promisify(
          createSendEmailJob({
            canDeliverNotificationEmail,
            deliverSignupReminder,
          }),
        )({
          attrs: {
            _id: new mongoose.Types.ObjectId(),
            data,
          },
        });
        delivered++;
      }
    }
    runAndDeliver().then(() => done(), done);
  };

  // Create an unconfirmed user
  beforeEach(function (done) {
    // Create a new user
    _unConfirmedUser = {
      public: false,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      emailTemporary: 'test@test.com', // unconfirmed users have this set
      emailToken: 'initial email token',
      username: 'userunconfirmed',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      created: sub(new Date(), { hours: 4 }),
    };

    unConfirmedUser = new User(_unConfirmedUser);

    // Save a user to the test db
    saveWithCallback(unConfirmedUser, done);
  });

  // Create a confirmed user
  beforeEach(function (done) {
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: 'userconfirmed',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
      created: sub(new Date(), { hours: 4 }),
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    saveWithCallback(confirmedUser, done);
  });

  it('Do not remind unconfirmed users <4 hours after their signup', function (done) {
    unConfirmedUser.created = sub(new Date(), { hours: 3, minutes: 58 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);

      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        },
      );
    });
  });

  it('Remind unconfirmed users >4 hours after their signup', function (done) {
    userFinishSignupJobHandler(
      { attrs: { _id: { toString: () => 'fixture-job-id' } } },
      function (err: Error | null | undefined) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('deliver signup reminder');
        jobs[0].data.subject.should.equal('Complete your signup to Trustroots');
        jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
        (['html', 'text'] as const).forEach(function (format) {
          jobs[0].data[format].should.containEql(
            'This is a reminder 1/3, after which we will stop sending you emails.',
          );
          jobs[0].data[format].should.containEql('4 hours ago');
        });

        findUserByEmail(_unConfirmedUser.email, function (err, user) {
          if (err) return done(err);
          if (!user) return done(new Error('Expected reminder user'));
          user.publicReminderCount!.should.equal(1);
          should.exist(user.publicReminderSent);
          done();
        });
      },
    );
  });

  for (const { state, update } of [
    { state: 'missing', update: { $unset: { emailTemporary: 1 } } },
    { state: 'empty', update: { $set: { emailTemporary: '' } } },
  ]) {
    it(`skips hidden members with a ${state} pending email`, async () => {
      await User.collection.updateOne({ _id: unConfirmedUser._id }, update);
      await promisify(userFinishSignupJobHandler)({
        attrs: { _id: new mongoose.Types.ObjectId() },
      });
      assert.equal(jobs.length, 0);
    });
  }

  for (const { state, update } of [
    {
      state: 'explicit null',
      update: {
        $set: {
          emailToken: null,
          emailTokenIssuedAt: null,
          emailTokenExpires: null,
        },
      },
    },
    {
      state: 'missing',
      update: {
        $unset: {
          emailToken: 1,
          emailTokenIssuedAt: 1,
          emailTokenExpires: 1,
        },
      },
    },
  ]) {
    it(`replaces ${state} token metadata on an older signup`, async () => {
      await User.collection.updateOne({ _id: unConfirmedUser._id }, update);
      await promisify(userFinishSignupJobHandler)({
        attrs: { _id: new mongoose.Types.ObjectId() },
      });

      const member = await User.findById(unConfirmedUser._id).orFail();
      assert.match(member.emailToken ?? '', /^sha256:[a-f0-9]{64}$/);
      assert.equal(member.publicReminderCount, 1);
    });
  }

  it('keeps a delivered link valid past the next reminder interval', async () => {
    await promisify(userFinishSignupJobHandler)({
      attrs: { _id: new mongoose.Types.ObjectId() },
    });
    const rawToken = jobs[0]?.data.text.match(
      /confirm-email\/([a-f0-9]{64})/,
    )?.[1];
    assert.ok(rawToken);
    const member = await User.findById(unConfirmedUser._id).orFail();
    assert.ok(member.emailTokenIssuedAt);
    assert.ok(member.emailTokenExpires);
    const issuedAt = member.emailTokenIssuedAt.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    assert.equal(member.emailTokenExpires.valueOf(), issuedAt + 3 * dayMs);
    assert.ok(
      await User.exists(
        emailConfirmationTokenQuery(rawToken, new Date(issuedAt + 2 * dayMs)),
      ),
    );
    assert.equal(
      await User.exists(
        emailConfirmationTokenQuery(rawToken, new Date(issuedAt + 3 * dayMs)),
      ),
      null,
    );
  });

  it('Remind unconfirmed users 2nd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 1;
    unConfirmedUser.publicReminderSent = sub(new Date(), { days: 2, hours: 1 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('deliver signup reminder');
          jobs[0].data.subject.should.equal(
            'Complete your signup to Trustroots',
          );
          jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
          (['html', 'text'] as const).forEach(function (format) {
            jobs[0].data[format].should.containEql(
              'This is a reminder 2/3, after which we will stop sending you emails.',
            );
            jobs[0].data[format].should.containEql('4 hours ago');
          });

          findUserByEmail(_unConfirmedUser.email, function (err, user) {
            if (err) return done(err);
            if (!user) return done(new Error('Expected reminder user'));
            user.publicReminderCount!.should.equal(2);
            should.exist(user.publicReminderSent);
            done();
          });
        },
      );
    });
  });

  it('Remind unconfirmed users 3rd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 2;
    unConfirmedUser.publicReminderSent = sub(new Date(), { days: 2, hours: 1 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('deliver signup reminder');
          jobs[0].data.subject.should.equal(
            'Last chance to complete your signup to Trustroots!',
          );
          jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
          (['html', 'text'] as const).forEach(function (format) {
            jobs[0].data[format].should.containEql(
              'This is our last reminder, after which we will stop sending you emails.',
            );
            jobs[0].data[format].should.containEql('4 hours ago');
          });

          findUserByEmail(_unConfirmedUser.email, function (err, user) {
            if (err) return done(err);
            if (!user) return done(new Error('Expected reminder user'));
            user.publicReminderCount!.should.equal(3);
            should.exist(user.publicReminderSent);
            done();
          });
        },
      );
    });
  });

  it('Reminder emails should tell how long ago user signed up.', function (done) {
    unConfirmedUser.created = sub(new Date(), { days: 8 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          (['html', 'text'] as const).forEach(function (format) {
            jobs[0].data[format].should.containEql('8 days ago');
          });
          done();
        },
      );
    });
  });

  it('Do not remind unconfirmed users >4 hours after their signup again before >2 days has passed', function (done) {
    // Run the job 1st time, sends notification
    userFinishSignupJobHandler(
      { attrs: { _id: { toString: () => 'fixture-job-id' } } },
      function (err: Error | null | undefined) {
        if (err) return done(err);

        // Run the same job 2nd time, should not send notification
        userFinishSignupJobHandler(
          { attrs: { _id: { toString: () => 'fixture-job-id' } } },
          function (err: Error | null | undefined) {
            if (err) return done(err);

            jobs.length.should.equal(1);
            jobs[0].type.should.equal('deliver signup reminder');
            jobs[0].data.subject.should.equal(
              'Complete your signup to Trustroots',
            );

            findUserByEmail(_unConfirmedUser.email, function (err, user) {
              if (err) return done(err);
              if (!user) return done(new Error('Expected reminder user'));
              user.publicReminderCount!.should.equal(1);
              done();
            });
          },
        );
      },
    );
  });

  it('Do not remind unconfirmed users >2 hours after their signup again before another >2 days has passed', function (done) {
    unConfirmedUser.publicReminderCount = 1;
    unConfirmedUser.publicReminderSent = sub(new Date(), { days: 2, hours: 1 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);

      // Run the job 1st time, sends notification
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          // Run the same job 2nd time, should not send notification
          userFinishSignupJobHandler(
            { attrs: { _id: { toString: () => 'fixture-job-id' } } },
            function (err: Error | null | undefined) {
              if (err) return done(err);

              jobs.length.should.equal(1);
              jobs[0].type.should.equal('deliver signup reminder');
              jobs[0].data.subject.should.equal(
                'Complete your signup to Trustroots',
              );

              findUserByEmail(_unConfirmedUser.email, function (err, user) {
                if (err) return done(err);
                if (!user) return done(new Error('Expected reminder user'));
                user.publicReminderCount!.should.equal(2);
                done();
              });
            },
          );
        },
      );
    });
  });

  it('Do not remind unconfirmed users 4rd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 3;
    unConfirmedUser.publicReminderSent = sub(new Date(), { days: 2 });
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          findUserByEmail(_unConfirmedUser.email, function (err, user) {
            if (err) return done(err);
            if (!user) return done(new Error('Expected reminder user'));
            user.publicReminderCount!.should.equal(3);
            should.exist(user.publicReminderSent);
            done();
          });
        },
      );
    });
  });

  it('Remind multiple unconfirmed users >4 hours after their signup, but no more than maximum amount of notifications at once', function (done) {
    // Create test users
    const _users = [];
    for (let i = 1; i <= config.limits.maxProcessSignupReminders + 1; i++) {
      const loopVars = {
        username: 'l' + i + _unConfirmedUser.username,
        emailToken: 'l' + i + _unConfirmedUser.emailToken,
        emailTemporary: 'l' + i + _unConfirmedUser.emailTemporary,
        email: 'l' + i + _unConfirmedUser.email,
      };
      const _unConfirmedUserLooped = {
        ..._unConfirmedUser,
        ...loopVars,
      };
      _users.push(_unConfirmedUserLooped);
    }

    // Save all users to the test db
    User.insertMany(_users)
      .then(function () {
        userFinishSignupJobHandler(
          { attrs: { _id: { toString: () => 'fixture-job-id' } } },
          function (err: Error | null | undefined) {
            if (err) return done(err);

            jobs.length.should.equal(config.limits.maxProcessSignupReminders);
            done();
          },
        );
      })
      .catch(err => done(err));
  });

  ['suspended', 'shadowban'].forEach(function (role) {
    it(`Do not remind users with "${role}" role`, function (done) {
      unConfirmedUser.roles = [role];
      unConfirmedUser.created = sub(new Date(), { days: 8 });
      saveWithCallback(
        unConfirmedUser,
        function (err: Error | null | undefined) {
          if (err) return done(err);

          userFinishSignupJobHandler(
            { attrs: { _id: { toString: () => 'fixture-job-id' } } },
            function (err: Error | null | undefined) {
              if (err) return done(err);
              jobs.length.should.equal(0);
              done();
            },
          );
        },
      );
    });
  });

  afterEach(function (done) {
    User.deleteMany()
      .exec()
      .then(() => done(), done);
  });
});
