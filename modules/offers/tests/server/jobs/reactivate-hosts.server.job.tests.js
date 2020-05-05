/**
 * Module dependencies.
 */
const path = require('path');
const should = require('should');
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const config = require(path.resolve('./config/config'));
const moment = require('moment');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Offer = mongoose.model('Offer');

/**
 * Globals
 */
let user;
let _user;
let offerHost;
let _offerHost;
let reactivateHostsJobHandler;

describe('Job: reactivate members with hosting offer status set to "no"', function () {
  const jobs = testutils.catchJobs();

  before(function () {
    reactivateHostsJobHandler = require(path.resolve(
      './modules/offers/server/jobs/reactivate-hosts.server.job',
    ));
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
    user.save(done);
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
      updated: moment().subtract(
        moment.duration(config.limits.timeToReactivateHosts),
      ),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177],
    };

    offerHost = new Offer(_offerHost);

    // Save offer to the test db
    offerHost.save(done);
  });

  it('Send reactivation email for offers modified longer than configured limit ago', function (done) {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    reactivateHostsJobHandler({}, function (err) {
      if (err) return done(err);

      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal(
        _user.firstName + ', start hosting on Trustroots again?',
      );
      jobs[0].data.to.address.should.equal(_user.email);

      Offer.findOne({ user: user._id }, function (err, offerRes) {
        if (err) return done(err);
        should.exist(offerRes.reactivateReminderSent);
        done();
      });
    });
  });

  it('Send reactivation email for un-confirmed profiles', function (done) {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    user.public = false;
    user.save(function (err) {
      if (err) return done(err);

      reactivateHostsJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(
          _user.firstName + ', start hosting on Trustroots again?',
        );
        jobs[0].data.to.address.should.equal(_user.email);

        Offer.findOne({ user: user._id }, function (err, offerRes) {
          if (err) return done(err);
          should.exist(offerRes.reactivateReminderSent);
          done();
        });
      });
    });
  });

  it('Do not send reactivation email for offers modified less than configured limit ago', function (done) {
    offerHost.updated = new Date();
    offerHost.save(function (err) {
      if (err) return done(err);
      reactivateHostsJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Do not send reactivation email for "yes" hosting offers', function (done) {
    offerHost.status = 'yes';
    offerHost.save(function (err) {
      if (err) return done(err);
      reactivateHostsJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Do not send reactivation email for "maybe" hosting offers', function (done) {
    offerHost.status = 'maybe';
    offerHost.save(function (err) {
      if (err) return done(err);
      reactivateHostsJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Do not send reactivation email for hosting offers without status', function (done) {
    offerHost.status = undefined;
    offerHost.save(function (err) {
      if (err) return done(err);
      reactivateHostsJobHandler({}, function (err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  it('Do not send reactivation email for non-hosting offers', function (done) {
    const _offerMeet = {
      type: 'meet',
      user: user._id,
      updated: moment().subtract(
        moment.duration(config.limits.timeToReactivateHosts),
      ),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177],
    };

    const offerMeet = new Offer(_offerMeet);

    // Save meet offer to db
    offerMeet.save(function (err) {
      if (err) return done(err);

      // Remove host offer as we don't want it to interfer with this test
      offerHost.remove(function (err) {
        if (err) return done(err);

        reactivateHostsJobHandler({}, function (err) {
          if (err) return done(err);
          jobs.length.should.equal(0);
          done();
        });
      });
    });
  });

  afterEach(function (done) {
    Offer.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
  });
});
