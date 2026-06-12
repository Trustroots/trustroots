/**
 * Unit tests for uncovered reactivate-hosts job error paths.
 */
const sinon = require('sinon');
const mongoose = require('mongoose');

const emailService = require('../../../../core/server/services/email.server.service');
const reactivateHostsJobHandler = require('../../../server/jobs/reactivate-hosts.server.job');
const testutils = require('../../../../../testutils/server/server.testutil');
const config = require('../../../../../config/config');
const moment = require('moment');
require('should');

const User = mongoose.model('User');
const Offer = mongoose.model('Offer');

describe('Job: reactivate hosts unit tests', () => {
  const jobs = testutils.catchJobs();
  let user;
  let offerHost;

  beforeEach(function (done) {
    user = new User({
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'reactivate-unit@test.com',
      username: 'reactivateunit',
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
    });

    user.save(function (err) {
      if (err) {
        return done(err);
      }

      offerHost = new Offer({
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
      });

      offerHost.save(done);
    });
  });

  afterEach(function (done) {
    sinon.restore();
    Offer.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
  });

  it('passes lookup errors to agenda', function (done) {
    sinon.stub(Offer, 'find').returns({
      populate: () => ({
        exec: cb => cb(new Error('lookup failed')),
      }),
    });

    reactivateHostsJobHandler({}, function (err) {
      err.message.should.equal('lookup failed');
      jobs.length.should.equal(0);
      done();
    });
  });

  it('passes email send errors to agenda', function (done) {
    sinon
      .stub(emailService, 'sendReactivateHosts')
      .callsFake((offerUser, cb) => cb(new Error('mail failed')));

    reactivateHostsJobHandler({}, function (err) {
      err.message.should.equal('mail failed');
      jobs.length.should.equal(0);
      done();
    });
  });
});
