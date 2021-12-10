/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const should = require('should');
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const config = require(path.resolve('./config/config'));
const moment = require('moment');
const mongoose = require('mongoose');
const User = mongoose.model('User');

/**
 * Globals
 */
let unConfirmedUser;
let _unConfirmedUser;
let confirmedUser;
let _confirmedUser;
let userFinishSignupJobHandler;

describe('Job: user finish signup', function () {
  const jobs = testutils.catchJobs();

  before(function () {
    userFinishSignupJobHandler = require(path.resolve(
      './modules/users/server/jobs/user-finish-signup.server.job',
    ));
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
      username: 'user_unconfirmed',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      created: moment().subtract(moment.duration({ hours: 4 })),
    };

    unConfirmedUser = new User(_unConfirmedUser);

    // Save a user to the test db
    unConfirmedUser.save(done);
  });

  // Create a confirmed user
  beforeEach(function (done) {
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: 'user_confirmed',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
      created: moment().subtract(moment.duration({ hours: 4 })),
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    confirmedUser.save(done);
  });

  it('Do not remind unconfirmed users <4 hours after their signup', function (done) {
    unConfirmedUser.created = moment().subtract(
      moment.duration({ hours: 3, minutes: 58 }),
    );
    unConfirmedUser.save(function (err) {
      if (err) return done(err);

      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Remind unconfirmed users >4 hours after their signup', function (done) {
    userFinishSignupJobHandler({}, function (err) {
      if (err) return done(err);

      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal('Complete your signup to Trustroots');
      jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
      ['html', 'text'].forEach(function (format) {
        jobs[0].data[format].should.containEql(
          'This is a reminder 1/3, after which we will stop sending you emails.',
        );
        jobs[0].data[format].should.containEql('4 hours ago');
      });

      User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
        if (err) return done(err);
        user.publicReminderCount.should.equal(1);
        should.exist(user.publicReminderSent);
        done();
      });
    });
  });

  it('Remind unconfirmed users 2nd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 1;
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2 }),
    );
    unConfirmedUser.save(function (err) {
      if (err) return done(err);
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Complete your signup to Trustroots');
        jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
        ['html', 'text'].forEach(function (format) {
          jobs[0].data[format].should.containEql(
            'This is a reminder 2/3, after which we will stop sending you emails.',
          );
          jobs[0].data[format].should.containEql('4 hours ago');
        });

        User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
          if (err) return done(err);
          user.publicReminderCount.should.equal(2);
          should.exist(user.publicReminderSent);
          done();
        });
      });
    });
  });

  it('Remind unconfirmed users 3rd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 2;
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2 }),
    );
    unConfirmedUser.save(function (err) {
      if (err) return done(err);
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(
          'Last chance to complete your signup to Trustroots!',
        );
        jobs[0].data.to.address.should.equal(_unConfirmedUser.email);
        ['html', 'text'].forEach(function (format) {
          jobs[0].data[format].should.containEql(
            'This is our last reminder, after which we will stop sending you emails.',
          );
          jobs[0].data[format].should.containEql('4 hours ago');
        });

        User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
          if (err) return done(err);
          user.publicReminderCount.should.equal(3);
          should.exist(user.publicReminderSent);
          done();
        });
      });
    });
  });

  it('Reminder emails should tell how long ago user signed up.', function (done) {
    unConfirmedUser.created = moment().subtract(moment.duration({ days: 8 }));
    unConfirmedUser.save(function (err) {
      if (err) return done(err);
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        ['html', 'text'].forEach(function (format) {
          jobs[0].data[format].should.containEql('8 days ago');
        });
        done();
      });
    });
  });

  it('Do not remind unconfirmed users >4 hours after their signup again before >2 days has passed', function (done) {
    // Run the job 1st time, sends notification
    userFinishSignupJobHandler({}, function (err) {
      if (err) return done(err);

      // Run the same job 2nd time, should not send notification
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal('Complete your signup to Trustroots');

        User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
          if (err) return done(err);
          user.publicReminderCount.should.equal(1);
          done();
        });
      });
    });
  });

  it('Do not remind unconfirmed users >2 hours after their signup again before another >2 days has passed', function (done) {
    unConfirmedUser.publicReminderCount = 1;
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2 }),
    );
    unConfirmedUser.save(function (err) {
      if (err) return done(err);

      // Run the job 1st time, sends notification
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        // Run the same job 2nd time, should not send notification
        userFinishSignupJobHandler({}, function (err) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
          jobs[0].data.subject.should.equal(
            'Complete your signup to Trustroots',
          );

          User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
            if (err) return done(err);
            user.publicReminderCount.should.equal(2);
            done();
          });
        });
      });
    });
  });

  it('Do not remind unconfirmed users 4rd time >2 days after previous notification', function (done) {
    unConfirmedUser.publicReminderCount = 3;
    unConfirmedUser.publicReminderSent = moment().subtract(
      moment.duration({ days: 2 }),
    );
    unConfirmedUser.save(function (err) {
      if (err) return done(err);
      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        User.findOne({ email: _unConfirmedUser.email }, function (err, user) {
          if (err) return done(err);
          user.publicReminderCount.should.equal(3);
          should.exist(user.publicReminderSent);
          done();
        });
      });
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
    User.insertMany(_users, function (err) {
      if (err) return done(err);

      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(config.limits.maxProcessSignupReminders);
        done();
      });
    });
  });

  it('Do not remind users with "suspended" role', function (done) {
    unConfirmedUser.roles = ['suspended'];
    unConfirmedUser.created = moment().subtract(moment.duration({ days: 8 }));
    unConfirmedUser.save(function (err) {
      if (err) return done(err);

      userFinishSignupJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  afterEach(function (done) {
    User.deleteMany().exec(done);
  });
});
