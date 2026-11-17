import mongoose from 'mongoose';
import sinon from 'sinon';
import authController from './../../server/controllers/users.authentication.server.controller.mts';
import passwordController from './../../server/controllers/users.password.server.controller.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import should from 'should';
import { deferredResponse } from '../../../../testutils/server/response.server.testutil.mts';
/**
 * Authentication and password controller behaviour when the underlying
 * Mongoose calls reject.
 */

const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');

describe('Authentication controller mongoose error handling', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('signup responds with 400 and clears credentials when save rejects', async () => {
    const attemptedUsers: import('../../../../testutils/server/model-contracts.mts').UserModelDocument[] =
      [];
    sinon.stub(User.prototype, 'save').callsFake(function (
      this: import('../../../../testutils/server/model-contracts.mts').UserModelDocument,
    ) {
      attemptedUsers.push(this);
      return Promise.reject(new Error('save failed'));
    });

    const res = deferredResponse();
    authController.signup(
      {
        body: {
          ageConfirmed: true,
          firstName: 'Fictional',
          lastName: 'Member',
          username: 'fictionalsaveerror',
          password: 'password123',
          email: 'fictionalsaveerror@example.test',
        },
        login: (_user: unknown, cb: () => void) => cb(),
      },
      res,
    );
    await res.waitForResponse();

    res.statusCode.should.equal(400);
    const savedUser = attemptedUsers[0];
    if (!savedUser) throw new Error('Expected a user save attempt');
    (savedUser.password === undefined).should.be.true();
    (savedUser.salt === undefined).should.be.true();
  });

  it('signupValidation treats a rejecting username lookup as available', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const res = deferredResponse();
    authController.signupValidation(
      { body: { username: 'someusername' } },
      res,
    );
    await res.waitForResponse();

    res.statusCode.should.equal(200);
    should(res.body).deepEqual({ valid: true });
  });

  it('validateEmailToken redirects to the invalid page when lookup rejects', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const res = deferredResponse();
    authController.validateEmailToken(
      { params: { token: 'token' } } as never,
      res,
    );
    await res.waitForResponse();

    should(res.redirectUrl).equal('/confirm-email-invalid');
  });

  it('confirmEmail responds with 400 when lookup rejects', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const res = deferredResponse();
    authController.confirmEmail({ params: { token: 'token' } } as never, res);
    await res.waitForResponse();

    res.statusCode.should.equal(400);
    should(res.body).have.property(
      'message',
      'Email confirm token is invalid or has expired.',
    );
  });

  it('validateResetToken redirects to the invalid page when lookup rejects', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const res = deferredResponse();
    passwordController.validateResetToken(
      { params: { token: 'token' } } as never,
      res,
    );
    await res.waitForResponse();

    should(res.redirectUrl).equal('/password/reset/invalid');
  });
});
