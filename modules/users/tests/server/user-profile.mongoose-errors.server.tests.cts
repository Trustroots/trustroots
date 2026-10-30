/**
 * Profile controller behaviour when the underlying Mongoose calls reject.
 */
import type { DeferredResponse } from '../../../../testutils/server/response.server.testutil.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const profileController = require('./../../server/controllers/users.profile.server.controller.mjs');
const emailService = require('./../../../core/server/services/email.server.service.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const should: typeof import('should') = require('should');

const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');

type MockResponse = DeferredResponse;
const {
  deferredResponse,
}: typeof import('../../../../testutils/server/response.server.testutil.mts') = require('../../../../testutils/server/response.server.testutil.mts');

function runHandler(
  invoke: (res: MockResponse, next: (error?: unknown) => void) => unknown,
): Promise<{ res: MockResponse; nextCalled: boolean; nextArg: unknown }> {
  return new Promise(resolve => {
    const res = deferredResponse();
    let nextCalled = false;
    let nextArg: unknown;
    const finish = () => resolve({ res, nextCalled, nextArg });
    void res.waitForResponse().then(finish);
    invoke(res, error => {
      nextCalled = true;
      nextArg = error;
      finish();
    });
  });
}

describe('Profile controller mongoose error handling', () => {
  let saved: import('../../../../testutils/server/model-contracts.mts').UserDocument;

  beforeEach(async () => {
    [saved] = await utils.saveUsers(utils.generateUsers(1));
  });

  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('update continues when the email availability lookup rejects', async () => {
    const userDoc = await User.findById(saved._id);
    if (!userDoc) throw new Error('Expected the saved user');
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const { res } = await runHandler(res =>
      profileController.update(
        { user: userDoc, body: { email: 'changed-email@example.com' } },
        res,
      ),
    );

    res.statusCode.should.equal(200);
  });

  it('initializeRemoveProfile reports failure when the user no longer exists', async () => {
    sinon.stub(User, 'findOneAndUpdate').resolves(null);
    sinon
      .stub(emailService, 'sendRemoveProfile')
      .callsFake((_user: unknown, callback: unknown) => {
        if (typeof callback !== 'function')
          throw new Error('Expected an email callback');
        callback(new Error('no user'));
      });

    const { res } = await runHandler(res =>
      profileController.initializeRemoveProfile(
        { user: { _id: saved._id, roles: [] } },
        res,
      ),
    );

    res.statusCode.should.equal(400);
  });

  it('removeProfile responds with 400 when the token lookup rejects', async () => {
    sinon.stub(User, 'findOne').rejects(new Error('db down'));

    const { res } = await runHandler(res =>
      profileController.removeProfile(
        { user: { _id: saved._id }, params: { token: 'token' } },
        res,
      ),
    );

    res.statusCode.should.equal(400);
    should(res.body).have.property(
      'message',
      'Profile remove token is invalid or has expired.',
    );
  });

  it('removeProfile responds with 400 when deleting the user rejects', async () => {
    const userDoc = await User.findById(saved._id);
    if (!userDoc) throw new Error('Expected the saved user');
    userDoc.removeProfileToken = 'valid-remove-token';
    userDoc.removeProfileExpires = new Date(Date.now() + 3600000);
    await userDoc.save();
    sinon.stub(User, 'findOneAndDelete').rejects(new Error('db down'));

    const { res } = await runHandler(res =>
      profileController.removeProfile(
        {
          user: { _id: saved._id },
          params: { token: 'valid-remove-token' },
        },
        res,
      ),
    );

    res.statusCode.should.equal(400);
  });

  it('userMiniByID responds with 404 when the lookup rejects', async () => {
    sinon.stub(User, 'findById').rejects(new Error('db down'));

    const { res } = await runHandler((res, next) =>
      profileController.userMiniByID(
        { user: { _id: saved._id } },
        res,
        next,
        saved._id.toString(),
      ),
    );

    res.statusCode.should.equal(404);
  });

  it('userByUsername responds with 404 when the lookup rejects', async () => {
    sinon.stub(User, 'findOne').returns({
      populate: () => Promise.reject(new Error('db down')),
    } as unknown as ReturnType<typeof User.findOne>);

    const { res } = await runHandler((res, next) =>
      profileController.userByUsername(
        { user: { _id: saved._id, roles: [] } },
        res,
        next,
        'someusername',
      ),
    );

    res.statusCode.should.equal(404);
  });
});
