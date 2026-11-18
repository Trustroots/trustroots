import type {
  OfferDocument,
  OfferModel,
  OfferRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
import should from 'should';
import * as testutils from '../../../../../testutils/server/server.testutil.mts';
import config from './../../../../../config/config.mts';
import moment from 'moment';
import mongoose from 'mongoose';
import reactivateHostsJobHandler from '../../../server/jobs/reactivate-hosts.server.job.mts';
const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');

/**
 * Globals
 */
let user: UserModelDocument;
let _user: UserRecord;
let offerHost: OfferDocument;
let _offerHost: OfferRecord;

describe('Job: reactivate members with hosting offer status set to "no"', function () {
  const jobs = testutils.catchJobs<{
    subject: string;
    to: { address: string };
  }>();

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
