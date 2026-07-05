const should = require('should');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

describe('Job: user finish signup direct unit tests', function () {
  afterEach(function () {
    sinon.restore();
  });

  function loadJob(config) {
    const query = {
      and: sinon.stub(),
      limit: sinon.stub(),
      exec: sinon.stub(),
    };
    query.and.returns(query);
    query.limit.returns(query);

    const User = {
      find: sinon.stub().returns(query),
      findByIdAndUpdate: sinon.stub(),
    };
    const emailService = {
      sendSignupEmailReminder: sinon.stub(),
    };
    const log = sinon.spy();

    const job = proxyquire(
      '../../../server/jobs/user-finish-signup.server.job',
      {
        '../../../../config/config': config,
        '../../../../config/lib/logger': log,
        '../../../core/server/services/email.server.service': emailService,
        mongoose: {
          model: name => {
            name.should.equal('User');
            return User;
          },
        },
      },
    );

    return { emailService, job, log, query, User };
  }

  it('uses fallback reminder limits and finishes cleanly when no users match', function (done) {
    const { emailService, job, query, User } = loadJob({ limits: {} });
    query.exec.callsArgWith(0, null, []);

    job({ attrs: { _id: { toString: () => 'job-id' } } }, function (err) {
      try {
        should.not.exist(err);
        sinon.assert.calledOnce(User.find);
        User.find.firstCall.args[0].roles.should.eql({
          $not: {
            $eq: 'suspended',
          },
        });
        query.and.firstCall.args[0][0].$or[0].publicReminderCount.$lt.should.equal(
          3,
        );
        sinon.assert.calledOnceWithExactly(query.limit, 50);
        sinon.assert.notCalled(emailService.sendSignupEmailReminder);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('marks each reminded user after sending signup reminders', function (done) {
    const user = { _id: 'user-id' };
    const { emailService, job, query, User } = loadJob({
      limits: {
        maxProcessSignupReminders: 2,
        maxSignupReminders: 1,
      },
    });
    query.exec.callsArgWith(0, null, [user]);
    emailService.sendSignupEmailReminder.callsArgWith(1, null);
    User.findByIdAndUpdate.callsArgWith(2, null);

    job({ attrs: { _id: { toString: () => 'job-id' } } }, function (err) {
      try {
        should.not.exist(err);
        query.and.firstCall.args[0][0].$or[0].publicReminderCount.$lt.should.equal(
          1,
        );
        sinon.assert.calledOnceWithExactly(query.limit, 2);
        sinon.assert.calledOnceWithExactly(
          emailService.sendSignupEmailReminder,
          user,
          sinon.match.func,
        );
        sinon.assert.calledOnce(User.findByIdAndUpdate);
        User.findByIdAndUpdate.firstCall.args[0].should.equal('user-id');
        User.findByIdAndUpdate.firstCall.args[1].$inc.should.eql({
          publicReminderCount: 1,
        });
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
