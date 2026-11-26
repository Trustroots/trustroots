import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import sinon from 'sinon';
import request from 'supertest';
import winston from 'winston';
import express from '../../../../config/lib/express.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';
import emailService from '../../../core/server/services/email.server.service.mts';
import {
  cancel,
  cancelPendingEmail,
  stage,
} from '../../server/controllers/users.email-change.server.controller.mts';
import type {
  UserServerModel,
  UserServerRecord,
} from '../../server/models/user.server.types.mts';
import {
  emailToken,
  hashToken,
} from '../../server/services/action-token.server.service.mts';
import { EMAIL_CONFIRMATION_LIFETIME_MS } from '../../server/services/email-confirmation.server.service.mts';
import {
  encryptSecret,
  hashRecoveryCode,
} from '../../server/services/mfa.server.service.mjs';

const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const webPath = '/api/users/email-change';
const mobilePath = '/api/mobile/v0/account/email-change';
const currentEmail = 'account-email@example.test';
const newEmail = 'pending-email@example.test';
const credentials = {
  username: 'mailchangefixture',
  password: 'FictionalPassword123!',
};
const loginRecoveryCode = '1A2B3C4D5E6F7A8B';
const changeRecoveryCode = 'AA2B3C4D5E6F7A8B';

describe('Credential-confirmed account email changes', () => {
  let app: Awaited<ReturnType<typeof express.init>>;
  let user: InstanceType<typeof User>;
  let rawToken: string;
  let notification: sinon.SinonStub<
    Parameters<typeof emailService.sendEmailChangeNotification>
  >;
  let confirmation: sinon.SinonStub<
    Parameters<typeof emailService.sendChangeEmailConfirmation>
  >;

  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    rawToken = '';
    user = await User.create({
      ...credentials,
      email: currentEmail,
      provider: 'local',
      roles: ['user', 'admin'],
      displayName: 'Email Fixture',
      firstName: 'Email',
      lastName: 'Fixture',
      public: true,
    });
    confirmation = sinon
      .stub(emailService, 'sendChangeEmailConfirmation')
      .callsFake((member, done) => {
        assert.equal(member.emailTemporary, newEmail);
        rawToken = String(emailToken(member, 'emailToken'));
        done(null);
      });
    notification = sinon
      .stub(emailService, 'sendEmailChangeNotification')
      .callsArgWith(2, null);
  });
  afterEach(() => sinon.restore());
  afterEach(clearDatabase);

  async function signInBrowser() {
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    return agent;
  }

  async function signInMobile() {
    const signin = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    return `Bearer ${signin.body.accessToken}`;
  }

  const payload = { email: newEmail, currentPassword: credentials.password };

  function responseStub() {
    return {
      set: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
      json: sinon.spy(),
    };
  }

  it('isolates cookie and bearer routes and returns only own details with no-store', async () => {
    await request(app).post(webPath).send(payload).expect(403);
    const browser = await signInBrowser();
    const bearer = await signInMobile();
    await browser.post(mobilePath).send(payload).expect(401);
    await request(app)
      .post(webPath)
      .set('Authorization', bearer)
      .send(payload)
      .expect(403);
    await browser
      .post(webPath)
      .set('Origin', 'https://example.invalid')
      .send(payload)
      .expect(403);

    const write = sinon.spy(User, 'findOneAndUpdate');
    const staged = await request(app)
      .post(mobilePath)
      .set('Authorization', bearer)
      .send({ ...payload, email: `  ${newEmail.toUpperCase()}  ` })
      .expect(200);
    assert.equal(staged.headers['cache-control'], 'no-store');
    assert.equal(staged.body.email, currentEmail);
    assert.equal(staged.body.emailTemporary, newEmail);
    assert.equal(staged.body.emailConfirmed, true);
    assert.equal(staged.body.mfaEnabled, false);
    assert.equal(staged.body.emailToken, undefined);
    assert.equal(staged.body.password, undefined);
    const stageWrite = write
      .getCalls()
      .find(call => call.args[1]?.$set?.emailTemporary === newEmail);
    assert.ok(stageWrite);
    const [stageFilter, , stageOptions] = stageWrite.args;
    assert.deepEqual(stageFilter, {
      _id: user._id,
      public: true,
      roles: { $nin: ['suspended'] },
      email: currentEmail,
      $or: [{ authVersion: { $exists: false } }, { authVersion: 0 }],
    });
    assert.deepEqual(stageOptions, {
      returnDocument: 'after',
      runValidators: true,
    });
    const stored = await User.findById(user._id).orFail();
    assert.equal(stored.email, currentEmail);
    assert.equal(stored.emailToken, hashToken(rawToken));
    assert.equal(
      stored.emailTokenExpires!.getTime() -
        stored.emailTokenIssuedAt!.getTime(),
      EMAIL_CONFIRMATION_LIFETIME_MS,
    );
    sinon.assert.calledOnce(notification);
    sinon.assert.callOrder(notification, confirmation);
    assert.equal(notification.firstCall.args[0].email, currentEmail);
    assert.deepEqual(notification.firstCall.args[1], stored.emailTokenIssuedAt);

    const cancelled = await request(app)
      .delete(mobilePath)
      .set('Authorization', bearer)
      .send({ newEmail })
      .expect(200);
    assert.equal(cancelled.body.email, currentEmail);
    assert.equal(cancelled.headers['cache-control'], 'no-store');
    const cancelWrite = write
      .getCalls()
      .find(call => call.args[1]?.$unset?.emailTemporary === 1);
    assert.ok(cancelWrite);
    assert.deepEqual(cancelWrite.args[2], { returnDocument: 'after' });
    assert.equal(cancelled.body.emailTemporary, null);
    assert.equal(
      (await User.collection.findOne({ _id: user._id }))?.emailTemporary,
      undefined,
    );
    await request(app)
      .post(`/api/auth/confirm-email/${rawToken}`)
      .set('X-Trustroots-Request', '1')
      .expect(400);
  });

  it('requires credentials and rejects unsigned generic changes for confirmed accounts', async () => {
    const browser = await signInBrowser();
    const bearer = await signInMobile();
    for (const input of [
      { email: newEmail },
      { ...payload, currentPassword: 'Wrong-password1!' },
    ]) {
      const rejected = await request(app)
        .post(mobilePath)
        .set('Authorization', bearer)
        .send(input)
        .expect(400);
      assert.equal(
        rejected.body.message,
        'Password or authenticator confirmation failed.',
      );
    }
    await browser.put('/api/users').send({ email: newEmail }).expect(400);
    await request(app)
      .put('/api/mobile/v0/account')
      .set('Authorization', bearer)
      .send({ email: newEmail })
      .expect(400);
    await browser
      .put('/api/users')
      .send({ email: currentEmail, newsletter: true })
      .expect(200);
    assert.equal((await User.findById(user._id))?.emailTemporary, '');
    assert.equal(rawToken, '');
  });

  it('requires an authenticated request and valid email inputs at the controller boundary', async () => {
    for (const operation of [stage, cancel]) {
      const noMember = responseStub();
      await operation({}, noMember);
      sinon.assert.calledOnceWithExactly(noMember.status, 403);
      sinon.assert.calledOnceWithExactly(noMember.json, {
        message: 'Please sign in.',
      });
      const noBody = responseStub();
      await operation({ user }, noBody);
      sinon.assert.calledOnceWithExactly(noBody.status, 400);
    }
    const browser = await signInBrowser();
    await browser
      .post(webPath)
      .send({ ...payload, email: 'invalid' })
      .expect(400, { message: 'Please enter a valid email address.' });
    await browser
      .post(webPath)
      .send({ ...payload, currentPassword: '' })
      .expect(400, {
        message: 'Password or authenticator confirmation failed.',
      });
    const noRead = sinon.spy(User, 'findById');
    const invalidPassword = responseStub();
    await stage(
      { user, body: { ...payload, currentPassword: 7 } },
      invalidPassword,
    );
    sinon.assert.calledOnceWithExactly(invalidPassword.status, 400);
    sinon.assert.notCalled(noRead);
    noRead.restore();
    await browser
      .post(webPath)
      .send({ ...payload, email: currentEmail })
      .expect(400, { message: 'Enter a different email address.' });
    await browser
      .delete(webPath)
      .send({ newEmail: '' })
      .expect(400, { message: 'A pending email address is required.' });
    await browser
      .delete(webPath)
      .send({ newEmail: 7 })
      .expect(400, { message: 'A pending email address is required.' });
    const noWrite = sinon.spy(User, 'findOneAndUpdate');
    await browser.delete(webPath).send({ newEmail }).expect(409);
    sinon.assert.notCalled(noWrite);
    sinon.assert.notCalled(notification);
  });

  it('fails closed when verification races a change to the account credential version', async () => {
    const browser = await signInBrowser();
    const authenticate = sinon
      .stub(User.prototype, 'authenticate')
      .callsFake(async () => {
        await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
        return true;
      });
    await browser.post(webPath).send(payload).expect(400);
    const staleRequest = responseStub();
    await stage({ user, body: payload }, staleRequest);
    sinon.assert.calledOnceWithExactly(staleRequest.status, 400);
    sinon.assert.calledOnce(authenticate);
    assert.equal(
      (await User.collection.findOne({ _id: user._id }))?.emailToken,
      undefined,
    );
    sinon.assert.notCalled(confirmation);
  });

  it('accepts legacy unversioned records and fails closed on an invalid persisted version', async () => {
    await User.updateOne({ _id: user._id }, { $set: { authVersion: null } });
    user.set('authVersion', undefined);
    const invalid = responseStub();
    await stage({ user, body: payload }, invalid);
    sinon.assert.calledOnceWithExactly(invalid.status, 400);
    sinon.assert.notCalled(confirmation);

    await User.collection.updateOne(
      { _id: user._id },
      { $unset: { authVersion: 1 } },
    );
    const staged = responseStub();
    await stage({ user, body: payload }, staged);
    sinon.assert.notCalled(staged.status);
    const pending = await User.findById(user._id).orFail();
    pending.set('authVersion', undefined);
    const cancelled = await cancelPendingEmail(pending, newEmail);
    assert.ok(cancelled);
    assert.equal(cancelled.emailToken, undefined);
  });

  it('returns a recoverable cancellation error when the pending record cannot be updated', async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          authVersion: 3,
          emailTemporary: newEmail,
          emailToken: hashToken('fixture-pending'),
        },
      },
    );
    const member = await User.findById(user._id).orFail();
    sinon
      .stub(User, 'findOneAndUpdate')
      .throws(new Error('Database unavailable'));
    const unavailable = responseStub();
    await cancel({ user: member, body: { newEmail } }, unavailable);
    sinon.assert.calledOnceWithExactly(unavailable.status, 500);
    sinon.assert.calledOnceWithExactly(unavailable.json, {
      message: 'Unable to cancel the email change. Please try again.',
    });
    assert.equal((await User.findById(user._id))?.emailTemporary, newEmail);
  });

  it('returns a recoverable staging error before delivery when account storage fails', async () => {
    sinon.stub(User, 'findById').throws(new Error('Database unavailable'));
    const unavailable = responseStub();
    await stage({ user, body: payload }, unavailable);
    sinon.assert.calledOnceWithExactly(unavailable.status, 503);
    sinon.assert.notCalled(notification);
    sinon.assert.notCalled(confirmation);
  });

  it('rejects addresses already held or reserved by another member', async () => {
    await User.create({
      username: 'othermailfixture',
      password: credentials.password,
      email: newEmail,
      emailTemporary: 'reserved@example.test',
      provider: 'local',
      displayName: 'Other Fixture',
      firstName: 'Other',
      lastName: 'Fixture',
    });
    const browser = await signInBrowser();
    for (const email of [newEmail, 'reserved@example.test']) {
      await browser
        .post(webPath)
        .send({ ...payload, email })
        .expect(403, {
          message: 'This email is already in use. Please use another one.',
        });
    }
    sinon.assert.notCalled(notification);
    await User.updateOne(
      { username: 'othermailfixture' },
      {
        $set: {
          email: 'available-owner@example.test',
          emailTemporary: 'available-pending@example.test',
        },
      },
    );
    await browser.post(webPath).send(payload).expect(200);
  });

  it('rejects an account removed or suspended after request authentication', async () => {
    await User.updateOne({ _id: user._id }, { $set: { roles: ['suspended'] } });
    const suspended = responseStub();
    await stage({ user, body: payload }, suspended);
    sinon.assert.calledOnceWithExactly(suspended.status, 400);
    await User.deleteOne({ _id: user._id });
    const removed = responseStub();
    await stage({ user, body: payload }, removed);
    sinon.assert.calledOnceWithExactly(removed.status, 400);
    sinon.assert.notCalled(notification);
  });

  it('shares the credential confirmation rate limit between browser and bearer requests', async () => {
    const browser = await signInBrowser();
    const bearer = await signInMobile();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await browser.post(webPath).send({ email: newEmail }).expect(400);
    }
    const limited = await request(app)
      .post(mobilePath)
      .set('Authorization', bearer)
      .send(payload)
      .expect(429);
    assert.match(limited.headers['retry-after'], /^\d+$/);
    sinon.assert.notCalled(notification);
  });

  for (const noticeFails of [true, false]) {
    it(`removes only the failed staging when ${noticeFails ? 'the notice' : 'the confirmation'} cannot be queued`, async () => {
      const browser = await signInBrowser();
      const queueError = new Error('Queue unavailable');
      const log = sinon.stub(winston, 'log');
      if (noticeFails) notification.callsArgWith(2, queueError);
      else confirmation.callsArgWith(1, queueError);
      await browser.post(webPath).send(payload).expect(503, {
        message: 'Could not send email change confirmation. Please try again.',
      });
      sinon.assert.calledOnceWithExactly(
        log,
        'error',
        'Could not stage account email change.',
      );
      sinon.assert.calledOnce(notification);
      if (noticeFails) sinon.assert.notCalled(confirmation);
      else sinon.assert.callOrder(notification, confirmation);
      const stored = await User.collection.findOne({ _id: user._id });
      assert.equal(stored?.email, currentEmail);
      assert.equal(stored?.emailTemporary, noticeFails ? '' : undefined);
      assert.equal(stored?.emailToken, undefined);
    });
  }

  it('does not publish a pending token while queuing the current-address notice', async () => {
    const browser = await signInBrowser();
    notification.resetBehavior();
    notification.callsFake(async (_member, _issuedAt, done) => {
      const inProgress = await User.findById(user._id).orFail();
      assert.equal(inProgress.emailToken, undefined);
      assert.equal(inProgress.emailTemporary, '');
      done(null);
    });
    await browser.post(webPath).send(payload).expect(200);
    sinon.assert.callOrder(notification, confirmation);
  });

  it('leaves a newer email request intact when an earlier confirmation fails', async () => {
    const browser = await signInBrowser();
    const newerToken = hashToken('fixture-replacement');
    confirmation.callsFake(async (_member, done) => {
      await User.updateOne(
        { _id: user._id },
        { $set: { emailToken: newerToken } },
      );
      done(new Error('Queue unavailable'));
    });
    await browser.post(webPath).send(payload).expect(503);
    sinon.assert.callOrder(notification, confirmation);
    const stored = await User.findById(user._id).orFail();
    assert.equal(stored.emailTemporary, newEmail);
    assert.equal(stored.emailToken, newerToken);
  });

  it('requires and consumes fresh MFA from an already verified browser session', async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          mfaEnabled: true,
          authVersion: 4,
          mfaSecretEncrypted: encryptSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'),
          mfaLastTotpCounter: -1,
          mfaRecoveryCodeHashes: [loginRecoveryCode, changeRecoveryCode].map(
            hashRecoveryCode,
          ),
        },
      },
    );
    const browser = request.agent(app);
    await browser.post('/api/auth/signin').send(credentials).expect(202);
    await browser
      .post('/api/auth/mfa/verify')
      .set('X-Trustroots-Request', '1')
      .send({ code: loginRecoveryCode })
      .expect(200);
    for (const input of [payload, { ...payload, mfaCode: loginRecoveryCode }]) {
      await browser.post(webPath).send(input).expect(400);
    }
    const staged = await browser
      .post(webPath)
      .send({ ...payload, mfaCode: changeRecoveryCode })
      .expect(200);
    assert.equal(staged.body.mfaEnabled, true);
    await browser
      .post(webPath)
      .send({ ...payload, mfaCode: changeRecoveryCode })
      .expect(400);
    const confirmed = await browser
      .post(`/api/auth/confirm-email/${rawToken}`)
      .set('X-Trustroots-Request', '1')
      .expect(200);
    assert.ok(confirmed.body.user);
    assert.equal(confirmed.body.mfaRequired, undefined);
    await browser.get('/api/users/mfa').expect(200);
    const stored = await User.findById(user._id).orFail();
    assert.equal(stored.email, newEmail);
    assert.equal(stored.authVersion, 5);
  });

  it('protects same-address replacement from a stale cancellation and revokes old bearer credentials after confirmation', async () => {
    const browser = await signInBrowser();
    const bearer = await signInMobile();
    await browser.post(webPath).send(payload).expect(200);
    const previous = rawToken;
    const staleMember = await User.findById(user._id).orFail();
    const writer = sinon.spy(User, 'findOneAndUpdate');
    await browser.post(webPath).send(payload).expect(200);
    assert.notEqual(rawToken, previous);
    assert.equal(await cancelPendingEmail(staleMember, newEmail), null);
    await browser
      .delete(webPath)
      .send({ newEmail: 'different-pending@example.test' })
      .expect(409);
    sinon.assert.callCount(writer, 2);
    await request(app)
      .post(`/api/auth/confirm-email/${previous}`)
      .set('X-Trustroots-Request', '1')
      .expect(400);
    await browser
      .post(`/api/auth/confirm-email/${rawToken}`)
      .set('X-Trustroots-Request', '1')
      .expect(200);
    await request(app)
      .get('/api/mobile/v0/me')
      .set('Authorization', bearer)
      .expect(401);
    const confirmed = await User.findById(user._id).orFail();
    assert.equal(confirmed.email, newEmail);
    assert.equal(confirmed.authVersion, 1);
    assert.equal(confirmed.emailToken, undefined);
  });

  it('binds cancellation to the authenticated nonzero credential version', async () => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          authVersion: 3,
          emailTemporary: newEmail,
          emailToken: hashToken('versioned-pending'),
        },
      },
    );
    const member = await User.findById(user._id).orFail();
    await User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
    assert.equal(await cancelPendingEmail(member, newEmail), null);
    const current = await User.findById(user._id).orFail();
    assert.equal(current.emailTemporary, newEmail);
    const cancelled = await cancelPendingEmail(current, newEmail);
    assert.ok(cancelled);
    assert.equal(cancelled.emailToken, undefined);
  });

  it('allows unconfirmed signup correction through the existing endpoint', async () => {
    await User.updateOne(
      { _id: user._id },
      { $set: { public: false, emailTemporary: currentEmail } },
    );
    const browser = await signInBrowser();
    await browser.post(webPath).send(payload).expect(400, {
      message: 'Confirm your current email address before changing it.',
    });
    sinon.assert.notCalled(notification);
    const corrected = await browser
      .put('/api/users')
      .send({ email: newEmail })
      .expect(200);
    assert.equal(corrected.body.emailConfirmed, false);
    assert.equal(corrected.body.emailTemporary, newEmail);
    assert.equal((await User.findById(user._id))?.email, currentEmail);
  });
});
