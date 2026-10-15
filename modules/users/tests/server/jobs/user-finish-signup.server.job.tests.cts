/**
 * Module dependencies.
 */
import type { HydratedDocument } from 'mongoose';
import type { UserRecord } from '../../../../../testutils/server/model-contracts.mts';

const _: typeof import('lodash') = require('lodash');
const should = require('should');
const testutils: typeof import('../../../../../testutils/server/server.testutil.mts') = require('../../../../../testutils/server/server.testutil');
const config: typeof import('../../../../../config/config.mts').default = require('./../../../../../config/config.mts');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
interface SignupReminderUser extends Omit<
  UserRecord,
  'created' | 'emailTokenIssuedAt' | 'emailTokenExpires'
> {
  created?: moment.Moment;
  publicReminderCount?: number;
  publicReminderSent?: moment.Moment;
  emailTokenIssuedAt?: moment.Moment;
  emailTokenExpires?: moment.Moment;
}
type SignupReminderDocument = HydratedDocument<SignupReminderUser>;
interface SignupReminderMail {
  type: 'send email';
  data: {
    subject: string;
    to: { address: string };
    html: string;
    text: string;
  };
}
const User = mongoose.model<SignupReminderUser>('User');

/**
 * Globals
 */
let unConfirmedUser: SignupReminderDocument;
let _unConfirmedUser: SignupReminderUser;
let confirmedUser: SignupReminderDocument;
let _confirmedUser: SignupReminderUser;
let userFinishSignupJobHandler: typeof import('./../../../server/jobs/user-finish-signup.server.job.mjs').default;

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
  const jobs = testutils.catchJobs() as SignupReminderMail[];

  before(function () {
    userFinishSignupJobHandler = require('./../../../server/jobs/user-finish-signup.server.job.mjs');
  });

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
      created: moment().subtract(moment.duration({ hours: 4 })),
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
      created: moment().subtract(moment.duration({ hours: 4 })),
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    saveWithCallback(confirmedUser, done);
  });

  it('Do not remind unconfirmed users <4 hours after their signup', function (done) {
    unConfirmedUser.created = moment().subtract(
      moment.duration({ hours: 3, minutes: 58 }),
    );
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
        jobs[0].type.should.equal('send email');
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

  it('Remind unconfirmed users 2nd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 1;
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2, hours: 1 }),
    );
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
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
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2, hours: 1 }),
    );
    saveWithCallback(unConfirmedUser, function (err: Error | null | undefined) {
      if (err) return done(err);
      userFinishSignupJobHandler(
        { attrs: { _id: { toString: () => 'fixture-job-id' } } },
        function (err: Error | null | undefined) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
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
    unConfirmedUser.created = moment().subtract(moment.duration({ days: 8 }));
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
            jobs[0].type.should.equal('send email');
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
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2, hours: 1 }),
    );
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
              jobs[0].type.should.equal('send email');
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
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2 }),
    );
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
      const _unConfirmedUserLooped = _.merge(
        _.clone(_unConfirmedUser),
        loopVars,
      );
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
      unConfirmedUser.created = moment().subtract(moment.duration({ days: 8 }));
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
