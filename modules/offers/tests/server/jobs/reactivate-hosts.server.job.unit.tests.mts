import type {
  OfferDocument,
  OfferModel,
  OfferRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';
/**
 * Unit tests for uncovered reactivate-hosts job error paths.
 */
import sinon from 'sinon';
import mongoose from 'mongoose';
import winston from 'winston';

import emailService from './../../../../core/server/services/email.server.service.mts';
import reactivateHostsJobHandler from './../../../server/jobs/reactivate-hosts.server.job.mts';
import * as testutils from '../../../../../testutils/server/server.testutil.mts';
import config from './../../../../../config/config.mts';
import moment from 'moment';
import should from 'should';

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

    user
      .save()
      .then(function () {
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

        offerHost.save().then(() => done(), done);
      })
      .catch(err => done(err));
  });

  afterEach(function (done) {
    sinon.restore();
    Offer.deleteMany()
      .exec()
      .then(function () {
        User.deleteMany()
          .exec()
          .then(() => done(), done);
      })
      .catch(err => done(err));
  });

  it('hands the reminder the contact details of the host', function (done) {
    const send = sinon
      .stub(emailService, 'sendReactivateHosts')
      .callsFake((_, cb) => cb());

    reactivateHostsJobHandler({}, function (err?: Error | null) {
      if (err) return done(err);
      send.callCount.should.equal(1);
      const recipient = send.firstCall.args[0] as unknown as {
        public: boolean;
        email: string;
        firstName: string;
        displayName: string;
        username?: string;
      };
      recipient.public.should.equal(true);
      recipient.email.should.equal('reactivate-unit@test.com');
      recipient.firstName.should.equal('Full');
      recipient.displayName.should.equal('Full Name');
      // Only the contact fields are loaded, not the whole member
      should(recipient.username).be.undefined();
      done();
    });
  });

  it('skips members who have disabled hosting reminders', async function () {
    await User.updateOne(
      { _id: user._id },
      { $set: { hostingReminderEmails: false } },
    );
    const send = sinon.stub(emailService, 'sendReactivateHosts');
    await new Promise<void>((resolve, reject) => {
      reactivateHostsJobHandler({}, error =>
        error ? reject(error) : resolve(),
      );
    });
    sinon.assert.notCalled(send);
    jobs.length.should.equal(0);
  });

  it('finishes without logging when the reminders went out', function (done) {
    const log = sinon.stub(winston, 'log');
    sinon.stub(emailService, 'sendReactivateHosts').callsFake((_, cb) => cb());

    reactivateHostsJobHandler({}, function (err?: Error | null) {
      (err === undefined || err === null).should.be.true();
      log.called.should.be.false();
      done();
    });
  });

  it('logs a failure before passing it to agenda', function (done) {
    const log = sinon.stub(winston, 'log');
    sinon
      .stub(emailService, 'sendReactivateHosts')
      .callsFake((_, cb) => cb(new Error('mail failed')));

    reactivateHostsJobHandler({}, function () {
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithMatch(
        log,
        'error',
        'Failure in reactivate hosts background job.',
      );
      done();
    });
  });

  it('passes lookup errors to agenda', function (done) {
    sinon.stub(Offer, 'find').returns({
      populate: () => ({
        exec: () => Promise.reject(new Error('lookup failed')),
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

  it('stops after an update fails', function (done) {
    const send = sinon
      .stub(emailService, 'sendReactivateHosts')
      .callsFake((_, cb) => cb());
    sinon.stub(Offer, 'findByIdAndUpdate').rejects(new Error('update failed'));

    reactivateHostsJobHandler({}, function (err?: Error | null) {
      if (!err) return done(new Error('Expected update failure'));
      err.message.should.equal('update failed');
      send.callCount.should.equal(1);
      done();
    });
  });
});
