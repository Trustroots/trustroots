const mongoose = require('mongoose');
const sinon = require('sinon');
require('should');

require('./../../server/models/user.server.model.mjs');
const profileController = require('./../../server/controllers/users.profile.server.controller.mjs');
const User = mongoose.model('User');
const emailService = require('./../../../core/server/services/email.server.service.mjs');
const mfaService = require('./../../server/services/mfa.server.service.mjs');

const userId = new mongoose.Types.ObjectId();
const activeEmail = 'member@example.test';
const requestedEmail = 'new-member@example.test';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function execQuery(result) {
  return { exec: async () => result };
}

function availabilityQuery(result) {
  return {
    select() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => result,
  };
}

function account(overrides = {}) {
  return {
    _id: userId,
    email: activeEmail,
    public: true,
    authVersion: 0,
    mfaEnabled: false,
    authenticate: async password => password === 'current-password',
    $locals: {},
    ...overrides,
  };
}

function authenticatedUser(overrides = {}) {
  return { _id: userId, email: activeEmail, authVersion: 0, ...overrides };
}

function stubSanitizer() {
  sinon.stub(profileController, 'sanitizeOwnProfile').callsFake(user => ({
    email: user.email,
    emailTemporary: user.emailTemporary,
  }));
}

describe('Email change lifecycle controller unit tests', () => {
  afterEach(() => sinon.restore());

  describe('changeEmail', () => {
    it('forbids an unauthenticated request', async () => {
      const res = createResponse();
      await profileController.changeEmail({ body: {} }, res);
      res.statusCode.should.equal(403);
    });

    it('rejects malformed email values before querying the account', async () => {
      const res = createResponse();
      await profileController.changeEmail(
        { user: authenticatedUser(), body: { email: 'not an email' } },
        res,
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Please enter a valid email address.');
    });

    it('returns the current profile when the normalized address is unchanged', async () => {
      const user = authenticatedUser();
      stubSanitizer();
      const res = createResponse();
      await profileController.changeEmail(
        { user, body: { email: ' MEMBER@example.test ' } },
        res,
      );
      res.statusCode.should.equal(200);
      res.body.email.should.equal(activeEmail);
    });

    it('requires the current address to be confirmed', async () => {
      sinon.stub(User, 'findById').returns(execQuery(null));
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Confirm your current email address before changing it.',
      );
    });

    it('rejects unconfirmed accounts returned by the account lookup', async () => {
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ public: false })));
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(400);
    });

    it('rejects a missing current password', async () => {
      sinon.stub(User, 'findById').returns(execQuery(account()));
      const res = createResponse();
      await profileController.changeEmail(
        { user: authenticatedUser(), body: { email: requestedEmail } },
        res,
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Password or authenticator confirmation failed.',
      );
    });

    it('rejects a stale authentication version after password verification', async () => {
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ authVersion: 3 })));
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser({ authVersion: 2 }),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(400);
    });

    it('rejects an address already assigned to another account', async () => {
      sinon.stub(User, 'findById').returns(execQuery(account()));
      sinon.stub(User, 'findOne').returns(availabilityQuery({ _id: userId }));
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(403);
    });

    it('requires a valid authenticator code when MFA is enabled', async () => {
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ mfaEnabled: true })));
      sinon.stub(User, 'findOne').returns(availabilityQuery(null));
      sinon.stub(mfaService.default, 'verifyAndConsume').resolves(null);
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(400);
      mfaService.default.verifyAndConsume.calledOnce.should.equal(true);
    });

    it('queues both confirmations after successful password and MFA checks', async () => {
      const updated = account({ emailTemporary: requestedEmail });
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ mfaEnabled: true })));
      sinon.stub(User, 'findOne').returns(availabilityQuery(null));
      sinon.stub(mfaService.default, 'verifyAndConsume').resolves(true);
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(execQuery(updated));
      sinon
        .stub(emailService, 'sendChangeEmailConfirmation')
        .callsFake((_user, callback) => callback());
      sinon
        .stub(emailService, 'sendEmailChangeNotificationToOldAddress')
        .callsFake((_user, _previousEmail, callback) => callback());
      stubSanitizer();
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: {
            email: requestedEmail,
            currentPassword: 'current-password',
            mfaCode: '123456',
          },
        },
        res,
      );
      res.statusCode.should.equal(200);
      res.body.emailTemporary.should.equal(requestedEmail);
      const tokenFields = update.firstCall.args[1].$set;
      tokenFields.emailTokenIssuedAt.should.be.instanceOf(Date);
      tokenFields.emailTokenExpires.should.be.instanceOf(Date);
      (
        tokenFields.emailTokenExpires.getTime() -
        tokenFields.emailTokenIssuedAt.getTime()
      ).should.equal(86400000);
      emailService.sendChangeEmailConfirmation.calledOnce.should.equal(true);
      emailService.sendEmailChangeNotificationToOldAddress.calledOnce.should.equal(
        true,
      );
    });

    it('matches accounts without an auth version in the conditional update', async () => {
      const updated = account({ emailTemporary: requestedEmail });
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ authVersion: undefined })));
      sinon.stub(User, 'findOne').returns(availabilityQuery(null));
      const update = sinon
        .stub(User, 'findOneAndUpdate')
        .returns(execQuery(updated));
      sinon
        .stub(emailService, 'sendChangeEmailConfirmation')
        .callsFake((_user, callback) => callback());
      sinon
        .stub(emailService, 'sendEmailChangeNotificationToOldAddress')
        .callsFake((_user, _previousEmail, callback) => callback());
      stubSanitizer();
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser({ authVersion: undefined }),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      Array.isArray(update.firstCall.args[0].$or).should.equal(true);
      update.firstCall.args[0].$or.should.have.length(2);
      res.statusCode.should.equal(200);
    });

    it('returns a retry response when the conditional update loses a race', async () => {
      sinon
        .stub(User, 'findById')
        .returns(execQuery(account({ authVersion: 2 })));
      sinon.stub(User, 'findOne').returns(availabilityQuery(null));
      sinon.stub(User, 'findOneAndUpdate').returns(execQuery(null));
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser({ authVersion: 2 }),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(400);
    });

    it('returns a retry response when either email notification fails', async () => {
      const updated = account({ emailTemporary: requestedEmail });
      sinon.stub(User, 'findById').returns(execQuery(account()));
      sinon.stub(User, 'findOne').returns(availabilityQuery(null));
      sinon.stub(User, 'findOneAndUpdate').returns(execQuery(updated));
      sinon
        .stub(emailService, 'sendChangeEmailConfirmation')
        .callsFake((_user, callback) =>
          callback(new Error('mail unavailable')),
        );
      sinon
        .stub(emailService, 'sendEmailChangeNotificationToOldAddress')
        .callsFake((_user, _previousEmail, callback) => callback());
      const res = createResponse();
      await profileController.changeEmail(
        {
          user: authenticatedUser(),
          body: { email: requestedEmail, currentPassword: 'current-password' },
        },
        res,
      );
      res.statusCode.should.equal(503);
      res.body.message.should.equal(
        'Could not send email change confirmation. Please try again.',
      );
    });
  });

  describe('cancelEmailChange', () => {
    it('forbids an unauthenticated request', async () => {
      const res = createResponse();
      await profileController.cancelEmailChange({}, res);
      res.statusCode.should.equal(403);
    });

    it('removes a pending address and token', async () => {
      const user = account({ emailTemporary: requestedEmail });
      sinon.stub(User, 'findOneAndUpdate').returns(execQuery(user));
      stubSanitizer();
      const res = createResponse();
      await profileController.cancelEmailChange(
        {
          user: authenticatedUser({
            emailTemporary: requestedEmail,
            emailToken: 'pending-token',
          }),
        },
        res,
      );
      res.statusCode.should.equal(200);
      User.findOneAndUpdate.firstCall.args[0].emailTemporary.should.equal(
        requestedEmail,
      );
      User.findOneAndUpdate.firstCall.args[0].emailToken.should.equal(
        'pending-token',
      );
      Object.keys(
        User.findOneAndUpdate.firstCall.args[1].$unset,
      ).should.containEql('emailTokenIssuedAt');
      Object.keys(
        User.findOneAndUpdate.firstCall.args[1].$unset,
      ).should.containEql('emailTokenExpires');
    });

    it('returns the current profile when no change is pending', async () => {
      const user = account();
      sinon.stub(User, 'findOneAndUpdate').returns(execQuery(null));
      sinon.stub(User, 'findOne').returns(execQuery(user));
      stubSanitizer();
      const res = createResponse();
      await profileController.cancelEmailChange(
        { user: authenticatedUser() },
        res,
      );
      res.statusCode.should.equal(200);
      res.body.email.should.equal(activeEmail);
    });

    it('forbids cancellation when the current account is unavailable', async () => {
      sinon.stub(User, 'findOneAndUpdate').returns(execQuery(null));
      sinon.stub(User, 'findOne').returns(execQuery(null));
      const res = createResponse();
      await profileController.cancelEmailChange(
        { user: authenticatedUser() },
        res,
      );
      res.statusCode.should.equal(403);
    });

    it('returns a retry response when cancellation persistence fails', async () => {
      sinon.stub(User, 'findOneAndUpdate').returns({
        exec: async () => {
          throw new Error('database unavailable');
        },
      });
      const res = createResponse();
      await profileController.cancelEmailChange(
        {
          user: authenticatedUser({
            emailTemporary: requestedEmail,
            emailToken: 'pending-token',
          }),
        },
        res,
      );
      res.statusCode.should.equal(503);
      res.body.message.should.equal(
        'Could not cancel the pending email change. Please try again.',
      );
    });
  });
});
