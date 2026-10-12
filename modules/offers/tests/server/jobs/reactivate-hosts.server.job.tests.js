/**
 * Module dependencies.
 */
const should = require('should');
const testutils = require('../../../../../testutils/server/server.testutil');
const config = require('./../../../../../config/config.mjs');
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
    reactivateHostsJobHandler = require('./../../../server/jobs/reactivate-hosts.server.job.mjs');
  });

  // Create user
  beforeEach(async function () {
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
    await user.save();
  });

  // Create a hosting offer
  beforeEach(async function () {
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
    await offerHost.save();
  });

  const runJob = () =>
    new Promise((resolve, reject) => {
      reactivateHostsJobHandler({}, err => (err ? reject(err) : resolve()));
    });

  it('Send reactivation email for offers modified longer than configured limit ago', async function () {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    await runJob();

    jobs.length.should.equal(1);
    jobs[0].type.should.equal('send email');
    jobs[0].data.subject.should.equal(
      _user.firstName + ', start hosting on Trustroots again?',
    );
    jobs[0].data.to.address.should.equal(_user.email);

    const offerRes = await Offer.findOne({ user: user._id });
    should.exist(offerRes.reactivateReminderSent);
  });

  it('Send reactivation email for un-confirmed profiles', async function () {
    // This should not be there before notifications are sent
    should.not.exist(offerHost.reactivateReminderSent);

    user.public = false;
    await user.save();

    await runJob();

    jobs.length.should.equal(1);
    jobs[0].type.should.equal('send email');
    jobs[0].data.subject.should.equal(
      _user.firstName + ', start hosting on Trustroots again?',
    );
    jobs[0].data.to.address.should.equal(_user.email);

    const offerRes = await Offer.findOne({ user: user._id });
    should.exist(offerRes.reactivateReminderSent);
  });

  it('Do not send reactivation email for offers modified less than configured limit ago', async function () {
    offerHost.updated = new Date();
    await offerHost.save();
    await runJob();
    jobs.length.should.equal(0);
  });

  it('Do not send reactivation email for "yes" hosting offers', async function () {
    offerHost.status = 'yes';
    await offerHost.save();
    await runJob();
    jobs.length.should.equal(0);
  });

  it('Do not send reactivation email for "maybe" hosting offers', async function () {
    offerHost.status = 'maybe';
    await offerHost.save();
    await runJob();
    jobs.length.should.equal(0);
  });

  it('Do not send reactivation email for hosting offers without status', async function () {
    offerHost.status = undefined;
    await offerHost.save();
    await runJob();
    jobs.length.should.equal(0);
  });

  it('Do not send reactivation email for non-hosting offers', async function () {
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
    await offerMeet.save();

    // Remove host offer as we don't want it to interfer with this test
    await offerHost.deleteOne();

    await runJob();
    jobs.length.should.equal(0);
  });

  afterEach(async function () {
    await Offer.deleteMany();
    await User.deleteMany();
  });
});
