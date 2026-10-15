import type {
  OfferDocument,
  OfferModel,
  OfferRecord,
  TestConfigModule,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const testutils: typeof import('../../../../../testutils/server/server.testutil') = require('../../../../../testutils/server/server.testutil');
const config: TestConfigModule = require('./../../../../../config/config.mts');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');

/**
 * Globals
 */
let user: UserModelDocument;
let _user: UserRecord;
let offerHost: OfferDocument;
let _offerHost: OfferRecord;
let reactivateHostsJobHandler: typeof import('./../../../server/jobs/reactivate-hosts.server.job.mjs').run;

describe('Job: reactivate members with hosting offer status set to "no"', function () {
  const jobs = testutils.catchJobs<{
    subject: string;
    to: { address: string };
  }>();

  before(function () {
    reactivateHostsJobHandler = require('./../../../server/jobs/reactivate-hosts.server.job.mjs');
  });

  // Create user
  beforeEach(function (done) {
    // Create a new user
    _user = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: 'jobtester',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
    };

    user = new User(_user);

    // Save a user to the test db
    user.save().then(() => done(), done);
  });

  // Create a hosting offer
  beforeEach(function (done) {
    _offerHost = {
      type: 'host',
      user: user._id,
      status: 'no',
      description: '<p>I can host! :)</p>',
      noOfferDescription: '<p>I cannot host... :(</p>',
      maxGuests: 1,
      updated: moment()
        .subtract(moment.duration(config.limits.timeToReactivateHosts))
        .toDate(),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177],
    };

    offerHost = new Offer(_offerHost);

    // Save offer to the test db
    offerHost.save().then(() => done(), done);
  });

  it('Send reactivation email for offers modified longer than configured limit ago', function (done) {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
      if (err) return done(err);

      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal(
        _user.firstName + ', start hosting on Trustroots again?',
      );
      jobs[0].data.to.address.should.equal(_user.email);

      Offer.findOne({ user: user._id })
        .then(function (offerRes) {
          should.exist(offerRes?.reactivateReminderSent);
          done();
        })
        .catch(err => done(err));
    });
  });

  it('Send reactivation email for un-confirmed profiles', function (done) {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    user.public = false;
    user
      .save()
      .then(function () {
        reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
          jobs[0].data.subject.should.equal(
            _user.firstName + ', start hosting on Trustroots again?',
          );
          jobs[0].data.to.address.should.equal(_user.email);

          Offer.findOne({ user: user._id })
            .then(function (offerRes) {
              should.exist(offerRes?.reactivateReminderSent);
              done();
            })
            .catch(function (err) {
              if (typeof done === 'function') return done(err);
              throw err;
            });
        });
      })
      .catch(err => done(err));
  });

  it('Do not send reactivation email for offers modified less than configured limit ago', function (done) {
    offerHost.updated = new Date();
    offerHost
      .save()
      .then(function () {
        reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        });
      })
      .catch(err => done(err));
  });

  it('Do not send reactivation email for "yes" hosting offers', function (done) {
    offerHost.status = 'yes';
    offerHost
      .save()
      .then(function () {
        reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        });
      })
      .catch(err => done(err));
  });

  it('Do not send reactivation email for "maybe" hosting offers', function (done) {
    offerHost.status = 'maybe';
    offerHost
      .save()
      .then(function () {
        reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        });
      })
      .catch(err => done(err));
  });

  it('Do not send reactivation email for hosting offers without status', function (done) {
    offerHost.status = undefined;
    offerHost
      .save()
      .then(function () {
        reactivateHostsJobHandler({}, function (err: Error | null | undefined) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        });
      })
      .catch(err => done(err));
  });

  it('Do not send reactivation email for non-hosting offers', function (done) {
    const _offerMeet = {
      type: 'meet',
      user: user._id,
      updated: moment()
        .subtract(moment.duration(config.limits.timeToReactivateHosts))
        .toDate(),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177],
    };

    const offerMeet = new Offer(_offerMeet);

    // Save meet offer to db
    offerMeet
      .save()
      .then(function () {
        // Remove host offer as we don't want it to interfer with this test
        offerHost
          .deleteOne()
          .then(function () {
            reactivateHostsJobHandler(
              {},
              function (err: Error | null | undefined) {
                if (err) return done(err);
                jobs.length.should.equal(0);
                done();
              },
            );
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  afterEach(function (done) {
    Offer.deleteMany()
      .exec()
      .then(function () {
        User.deleteMany()
          .exec()
          .then(() => done(), done);
      })
      .catch(err => done(err));
  });
});
