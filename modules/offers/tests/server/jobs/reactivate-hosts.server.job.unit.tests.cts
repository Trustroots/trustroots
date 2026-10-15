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
 * Unit tests for uncovered reactivate-hosts job error paths.
 */
const sinon: typeof import('sinon') = require('sinon');
const mongoose: typeof import('mongoose') = require('mongoose');

const emailService: typeof import('./../../../../core/server/services/email.server.service.mjs') = require('./../../../../core/server/services/email.server.service.mjs');
const reactivateHostsJobHandler: typeof import('./../../../server/jobs/reactivate-hosts.server.job.mjs').default = require('./../../../server/jobs/reactivate-hosts.server.job.mjs');
const testutils: typeof import('../../../../../testutils/server/server.testutil') = require('../../../../../testutils/server/server.testutil');
const config: TestConfigModule = require('./../../../../../config/config.mts');
const moment: typeof import('moment') = require('moment');
require('should');

const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');

describe('Job: reactivate hosts unit tests', () => {
  const jobs = testutils.catchJobs();
  let user: UserModelDocument;
  let offerHost: OfferDocument;

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
        exec: (cb: (error: Error) => void) => cb(new Error('lookup failed')),
      }),
    } as unknown as ReturnType<typeof Offer.find>);

    reactivateHostsJobHandler({}, function (err?: Error | null) {
      if (!err) return done(new Error('Expected lookup failure'));
      err.message.should.equal('lookup failed');
      jobs.length.should.equal(0);
      done();
    });
  });

  it('passes email send errors to agenda', function (done) {
    sinon
      .stub(emailService, 'sendReactivateHosts')
      .callsFake((offerUser, cb) => cb(new Error('mail failed')));

    reactivateHostsJobHandler({}, function (err?: Error | null) {
      if (!err) return done(new Error('Expected email failure'));
      err.message.should.equal('mail failed');
      jobs.length.should.equal(0);
      done();
    });
  });
});
