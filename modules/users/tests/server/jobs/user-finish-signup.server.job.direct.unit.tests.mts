import should from 'should';
import config from './../../../../../config/config.mts';
import mongoose from 'mongoose';
import winston from 'winston';
import emailService from './../../../../core/server/services/email.server.service.mts';
import job from './../../../server/jobs/user-finish-signup.server.job.mts';
import sinon from 'sinon';

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
    const sendSignupEmailReminder = sinon.stub(
      emailService,
      'sendSignupEmailReminder',
    );
    sinon.stub(config, 'limits').value(overrides.limits);
    const log = sinon.stub(winston.Logger.prototype, 'log');

    return {
      findUsers,
      job,
      log,
      query,
      sendSignupEmailReminder,
    };
  }

  it('uses fallback reminder limits and finishes cleanly when no users match', function (done) {
    const { findUsers, job, query, sendSignupEmailReminder } = loadJob({
      limits: {},
    });
    query.exec.resolves([]);

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

  it('logs a failed run with its job id', function (done) {
    const { job, log, query } = loadJob({ limits: {} });
    const error = new Error('lookup failed');
    query.exec.rejects(error);

    job({ attrs: { _id: { toString: () => 'job-id' } } }, function (err) {
      try {
        should(err).equal(error);
        sinon.assert.calledOnce(log);
        (log.firstCall.args as unknown[]).should.eql([
          'error',
          'Failure in finish signup reminder background job.',
          { error: { name: 'Error' }, jobId: 'job-id' },
        ]);
        done();
      } catch (failure) {
        done(failure);
      }
    });
  });

  it('queues a candidate token and leaves the current token on the member', async function () {
    const user = {
      _id: 'user-id',
      emailTemporary: 'pending@example.test',
      emailToken: 'previous-token',
    };
    const { job, log, query, sendSignupEmailReminder } = loadJob({
      limits: {
        maxProcessSignupReminders: 2,
        maxSignupReminders: 1,
      },
    });
    query.exec.resolves([user]);
    sendSignupEmailReminder.callsArgWith(1, null);

    await new Promise<void>((resolve, reject) =>
      job({ attrs: {} }, err => (err ? reject(err) : resolve())),
    );

    query.and.firstCall.args[0][0].$or[0].publicReminderCount.$lt.should.equal(
      1,
    );
    sinon.assert.calledOnceWithExactly(query.limit, 2);
    sinon.assert.calledOnce(sendSignupEmailReminder);
    const mailUser = record(callArgument(sendSignupEmailReminder, 0));
    const signupReminder = record(callArgument(sendSignupEmailReminder, 2));
    should(mailUser.emailToken).match(/^sha256:[a-f0-9]{64}$/);
    should(signupReminder.emailToken).equal(mailUser.emailToken);
    should(signupReminder.previousToken).equal('previous-token');
    should(signupReminder.userId).equal('user-id');
    user.emailToken.should.equal('previous-token');
    sinon.assert.notCalled(log);
  });
});
