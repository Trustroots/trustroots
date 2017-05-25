'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    should = require('should'),
    testutils = require(path.resolve('./testutils/server.testutil')),
    config = require(path.resolve('./config/config')),
    moment = require('moment'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Offer = mongoose.model('Offer');

/**
 * Globals
 */
var user,
    _user,
    offer,
    _offer,
    reactivateHostsJobHandler;

describe('Job: reactivate members with hosting offer status set to "no"', function() {

  var jobs = testutils.catchJobs();

  before(function() {
    reactivateHostsJobHandler = require(path.resolve('./modules/offers/server/jobs/reactivate-hosts.server.job'));
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
      displayUsername: 'jobtester',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local'
    };

    user = new User(_user);

    // Save a user to the test db
    user.save(done);
  });

  // Create a hosting offer
  beforeEach(function (done) {

    _offer = {
      user: user._id,
      status: 'no',
      description: '<p>I can host! :)</p>',
      noOfferDescription: '<p>I cannot host... :(</p>',
      maxGuests: 1,
      updated: moment().subtract(moment.duration(config.limits.timeToReactivateHosts)),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177]
    };

    offer = new Offer(_offer);

    // Save offer to the test db
    offer.save(done);
  });

  it('Send reactivation email for offers modified longer than configured limit ago', function(done) {

    // This should not be there before notifications are sent
    should.not.exist(offer.reactivateReminderSent);

    reactivateHostsJobHandler({}, function(err) {
      if (err) return done(err);

      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
      jobs[0].data.subject.should.equal(_user.firstName + ', start hosting on Trustroots again?');
      jobs[0].data.to.address.should.equal(_user.email);

      Offer.findOne({ user: user._id }, function(err, offerRes) {
        if (err) return done(err);
        should.exist(offerRes.reactivateReminderSent);
        done();
      });

    });
  });

  it('Send reactivation email for un-confirmed profiles', function(done) {

    // This should not be there before notifications are sent
    should.not.exist(offer.reactivateReminderSent);

    user.public = false;
    user.save(function(err) {
      if (err) return done(err);

      reactivateHostsJobHandler({}, function(err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(_user.firstName + ', start hosting on Trustroots again?');
        jobs[0].data.to.address.should.equal(_user.email);

        Offer.findOne({ user: user._id }, function(err, offerRes) {
          if (err) return done(err);
          should.exist(offerRes.reactivateReminderSent);
          done();
        });
      });
    });
  });

  it('Do not send reactivation email for offers modified less than configured limit ago', function(done) {
    offer.updated = new Date();
    offer.save(function(err) {
      if (err) return done(err);
      reactivateHostsJobHandler({}, function(err) {
        if (err) return done(err);
        jobs.length.should.equal(0);
        done();
      });
    });
  });

  afterEach(function (done) {
    Offer.remove().exec(function() {
      User.remove().exec(done);
    });
  });
});
