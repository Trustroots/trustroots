const should: typeof import('should') = require('should');
const config: typeof import('../../../../../config/config.mts').default = require('./../../../../../config/config.mts');
const mongoose: typeof import('mongoose') = require('mongoose');
const winston: typeof import('winston') = require('winston');
const emailService: typeof import('../../../../core/server/services/email.server.service.mjs').default = require('./../../../../core/server/services/email.server.service.mjs');
const job: typeof import('../../../server/jobs/user-finish-signup.server.job.mjs').default = require('./../../../server/jobs/user-finish-signup.server.job.mjs');
const sinon: typeof import('sinon') = require('sinon');

function present<T>(value: T | null | undefined): T {
  should.exist(value);
  if (value === null || value === undefined)
    throw new Error('Expected a value');
  return value;
}

function callArgument(
  stub: ReturnType<typeof sinon.stub>,
  index: number,
): unknown {
  const call = stub.firstCall;
  if (!call || index >= call.args.length)
    throw new Error('Expected a recorded call argument');
  return (call.args as unknown[])[index];
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null)
    throw new Error('Expected an object argument');
  return Object.fromEntries(Object.entries(value));
}

function date(value: unknown): Date {
  if (!(value instanceof Date)) throw new Error('Expected a date');
  return value;
}

describe('Job: user finish signup direct unit tests', function () {
  afterEach(function () {
    sinon.restore();
  });

  function loadJob(overrides: { limits: Record<string, number> }) {
    const query = {
      and: sinon.stub(),
      limit: sinon.stub(),
      exec: sinon.stub(),
    };
    query.and.returns(query);
    query.limit.returns(query);

    const User = mongoose.model('User');
    const findUsers = sinon.stub(User, 'find');
    // The production query is replaced by this intentionally partial fake chain.
    findUsers.returns(query as unknown as ReturnType<typeof User.find>);
    const findByIdAndUpdate = sinon.stub(User, 'findByIdAndUpdate');
    const updateOne = sinon.stub(User, 'updateOne');
    updateOne.callsArgWith(2, null, { matchedCount: 1 });
    const sendSignupEmailReminder = sinon.stub(
      emailService,
      'sendSignupEmailReminder',
    );
    sinon.stub(config, 'limits').value(overrides.limits);
    const log = sinon.stub(winston.Logger.prototype, 'log');

    return {
      findByIdAndUpdate,
      findUsers,
      job,
      log,
      query,
      sendSignupEmailReminder,
      updateOne,
    };
  }

  it('uses fallback reminder limits and finishes cleanly when no users match', function (done) {
    const { findUsers, job, query, sendSignupEmailReminder } = loadJob({
      limits: {},
    });
    query.exec.callsArgWith(0, null, []);

    job(
      { attrs: { _id: { toString: () => 'job-id' } } },
      function (err?: Error | null) {
        try {
          should.not.exist(err);
          sinon.assert.calledOnce(findUsers);
          record(record(callArgument(findUsers, 0)).roles).should.eql({
            $nin: ['suspended', 'shadowban'],
          });
          query.and.firstCall.args[0][0].$or[0].publicReminderCount.$lt.should.equal(
            3,
          );
          sinon.assert.calledOnceWithExactly(query.limit, 50);
          sinon.assert.notCalled(sendSignupEmailReminder);
          done();
        } catch (error) {
          done(error);
        }
      },
    );
  });

  it('marks each reminded user after sending signup reminders', function (done) {
    const user: {
      _id: string;
      emailToken?: string;
      emailTokenExpires?: Date;
      emailTokenIssuedAt?: Date;
    } = { _id: 'user-id' };
    const {
      findByIdAndUpdate,
      job,
      query,
      sendSignupEmailReminder,
      updateOne,
    } = loadJob({
      limits: {
        maxProcessSignupReminders: 2,
        maxSignupReminders: 1,
      },
    });
    query.exec.callsArgWith(0, null, [user]);
    sendSignupEmailReminder.callsArgWith(1, null);
    findByIdAndUpdate.callsArgWith(2, null);

    job(
      { attrs: { _id: { toString: () => 'job-id' } } },
      function (err?: Error | null) {
        try {
          should.not.exist(err);
          query.and.firstCall.args[0][0].$or[0].publicReminderCount.$lt.should.equal(
            1,
          );
          sinon.assert.calledOnceWithExactly(query.limit, 2);
          sinon.assert.calledOnceWithExactly(
            sendSignupEmailReminder,
            user,
            sinon.match.func,
          );
          present(user.emailToken).should.match(/^sha256:[a-f0-9]{64}$/);
          present(user.emailTokenExpires)
            .getTime()
            .should.equal(
              present(user.emailTokenIssuedAt).getTime() + 24 * 60 * 60 * 1000,
            );
          const updateFilter = record(callArgument(updateOne, 0));
          should(updateFilter.public).be.false();
          record(updateFilter.emailToken).should.eql({
            $exists: false,
          });
          const updateSet = record(record(callArgument(updateOne, 1)).$set);
          date(updateSet.emailTokenExpires)
            .getTime()
            .should.equal(present(user.emailTokenExpires).getTime());
          sinon.assert.calledOnce(findByIdAndUpdate);
          should(present(callArgument(findByIdAndUpdate, 0))).equal('user-id');
          record(record(callArgument(findByIdAndUpdate, 1)).$inc).should.eql({
            publicReminderCount: 1,
          });
          done();
        } catch (error) {
          done(error);
        }
      },
    );
  });
});
