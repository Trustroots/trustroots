/**
 * Module dependencies.
 */
import type { HydratedDocument } from 'mongoose';
import type { UserRecord } from '../../../../../testutils/server/model-contracts.mts';

const testutils: typeof import('../../../../../testutils/server/server.testutil.mts') = require('../../../../../testutils/server/server.testutil');
const config: typeof import('../../../../../config/config.mts').default = require('./../../../../../config/config.mts');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
require('should');
interface WelcomeSequenceUser extends Omit<UserRecord, 'created'> {
  created?: moment.Moment;
  welcomeSequenceStep?: number;
  welcomeSequenceSent?: moment.Moment;
  emailToken?: string;
  emailTemporary?: string;
}
type WelcomeSequenceDocument = HydratedDocument<WelcomeSequenceUser>;
type WelcomeSequenceJob = (
  job: object,
  done: (error?: Error | null) => void,
) => void;
interface WelcomeEmailJob {
  type: string;
  data: { from: { name: string }; subject: string; html: string };
}
const User = mongoose.model<WelcomeSequenceUser>('User');
function saveWithCallback(
  document: WelcomeSequenceDocument,
  callback: (error?: Error | null) => void,
): void {
  void document.save().then(
    () => callback(),
    error =>
      callback(error instanceof Error ? error : new Error(String(error))),
  );
}

/**
 * Globals
 */
let unConfirmedUser: WelcomeSequenceDocument;
let _unConfirmedUser: WelcomeSequenceUser;
let confirmedUser: WelcomeSequenceDocument;
let _confirmedUser: WelcomeSequenceUser;
let userWelcomeSequenceFirstJobHandler: WelcomeSequenceJob;
let userWelcomeSequenceSecondJobHandler: WelcomeSequenceJob;
let userWelcomeSequenceThirdJobHandler: WelcomeSequenceJob;
let timeLimit: moment.Moment;
let timePast: moment.Moment;

describe.skip('Job: welcome sequence, first email', function () {
  const jobs = testutils.catchJobs() as WelcomeEmailJob[];

  before(function () {
    userWelcomeSequenceFirstJobHandler = require('./../../../server/jobs/user-welcome-sequence-first.server.job.mjs');
    userWelcomeSequenceSecondJobHandler = require('./../../../server/jobs/user-welcome-sequence-second.server.job.mjs');
    userWelcomeSequenceThirdJobHandler = require('./../../../server/jobs/user-welcome-sequence-third.server.job.mjs');
  });

  // Create time points to test that welcome sequence is sent in correct time
  beforeEach(function (done) {
    // Take limit from config and set timer to past
    timeLimit = moment().subtract(
      moment.duration(config.limits.welcomeSequence.first),
    );

    // Move timer 15 minutes to past and future for testing
    timePast = moment(timeLimit).subtract(moment.duration({ minutes: 1 }));

    done();
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
      welcomeSequenceStep: 0,
      created: moment().subtract(moment.duration({ minutes: 3 })),
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
      welcomeSequenceStep: 0,
      welcomeSequenceSent: timePast,
      created: timePast,
    };

    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    saveWithCallback(confirmedUser, done);
  });

  it('Send first welcome sequence email to confirmed users only', function (done) {
    userWelcomeSequenceFirstJobHandler({}, function (err) {
      if (err) return done(err);
      // Confirmed user received welcome email, unconfirmed didn't
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.from.name.should.be.equalOneOf(config.supportVolunteerNames);
      jobs[0].data.subject.should.match(
        new RegExp('Welcome to Trustroots ' + _confirmedUser.firstName + '!'),
      );
      // Check that the email contains a link to profile
      jobs[0].data.html.should.match(/href="http.+\/profile\/user_confirmed/);
      done();
    });
  });

  it('Do not send welcome sequence emails to unconfirmed users', function (done) {
    saveWithCallback(unConfirmedUser, function (err) {
      if (err) return done(err);

      userWelcomeSequenceFirstJobHandler({}, function (err) {
        if (err) return done(err);
        // Confirmed user received welcome email, unconfirmed didn't
        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(
          '👋 Welcome to Trustroots ' + _confirmedUser.firstName + '!',
        );
        done();
      });
    });
  });

  it('Do not send second and third welcome sequence email when everyone is on step 1', function (done) {
    // Run second welcome sequence email job
    userWelcomeSequenceSecondJobHandler({}, function (err) {
      if (err) return done(err);
      // Run third welcome sequence email job
      userWelcomeSequenceThirdJobHandler({}, function (err) {
        if (err) return done(err);

        // Nobody shouldn't received email
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Do not send welcome sequence emails to suspended users', function (done) {
    confirmedUser.roles = ['suspended'];
    saveWithCallback(confirmedUser, function (err) {
      if (err) return done(err);

      userWelcomeSequenceFirstJobHandler({}, function (err) {
        if (err) return done(err);
        // Confirmed who is suspended, did not receive welcome email
        // Unconfirmed user didn't receive it neither
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  afterEach(function (done) {
    void User.deleteMany({})
      .exec()
      .then(() => done(), done);
  });
});
