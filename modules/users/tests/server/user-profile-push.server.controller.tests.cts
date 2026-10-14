/**
 * Unit tests for the push-registration and tribe-membership handlers of the
 * profile controller. These are exercised directly with mock req/res objects
 * against the test database.
 */
import type { Types } from 'mongoose';
import type { UserRecord } from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

require('./../../server/models/user.server.model.mjs');
require('./../../../contacts/server/models/contacts.server.model.mjs');
require('./../../../messages/server/models/message.server.model.mjs');
require('./../../../messages/server/models/message-stat.server.model.mjs');
require('./../../../messages/server/models/thread.server.model.mjs');
require('./../../../offers/server/models/offer.server.model.mjs');
require('./../../../tribes/server/models/tribe.server.model.mjs');

interface ProfilePushRecord extends UserRecord {
  pushRegistration?: Array<{ platform: string; token: string }>;
}
interface PushRequest {
  user?: { _id: string | Types.ObjectId };
  params?: { token?: string };
  body?: { token?: string; platform?: string };
}
interface TestResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
  json(body: unknown): this;
  waitForResponse(): Promise<TestResponse>;
}
type Handler = (request: PushRequest, response: TestResponse) => void;
interface ProfileController {
  getUserMemberships: Handler;
  removePushRegistration: Handler;
  addPushRegistration: Handler;
}
const profileController: ProfileController = require('./../../server/controllers/users.profile.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model<ProfilePushRecord>('User');

const errorServicePath =
  './../../../core/server/services/error.server.service.mjs';

function loadControllerWithEmptyErrorMessage() {
  sinon.stub(require(errorServicePath), 'getErrorMessage').returns(false);
  return profileController;
}

function deferredResponse(): TestResponse {
  let resolveResponse: (response: TestResponse) => void = () => {};
  const promise = new Promise<TestResponse>(resolve => {
    resolveResponse = resolve;
  });

  const res: TestResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    json(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

function responseBody(response: TestResponse): unknown {
  if (!response.body) throw new Error('expected response body');
  return response.body;
}
function responseMessage(response: TestResponse): string {
  const body = responseBody(response);
  if (
    typeof body !== 'object' ||
    body === null ||
    !('message' in body) ||
    typeof body.message !== 'string'
  ) {
    throw new Error('expected response message');
  }
  return body.message;
}
function responseArray(response: TestResponse): unknown[] {
  const body = responseBody(response);
  if (!Array.isArray(body)) throw new Error('expected a response array');
  return body;
}
function failedQuery(error: unknown): {
  exec(callback: (error: unknown) => void): void;
} {
  return { exec: callback => callback(error) };
}

describe('Profile controller push/membership unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return mongoose.connection.readyState ? utils.clearDatabase() : undefined;
  });

  describe('getUserMemberships', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.getUserMemberships({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('returns the list of memberships', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.getUserMemberships({ user: { _id: saved._id } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      const memberships = responseArray(res);
      memberships.should.be.an.Array();
      memberships.length.should.equal(0);
    });

    it('returns 400 when loading memberships fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const failedMembershipQuery = {
        populate() {
          return failedMembershipQuery;
        },
        exec(callback: (error: unknown) => void) {
          callback(new Error('db error'));
        },
      };
      sinon
        .stub(User, 'findById')
        .returns(
          failedMembershipQuery as unknown as ReturnType<typeof User.findById>,
        );

      const res = deferredResponse();
      profileController.getUserMemberships({ user: { _id: saved._id } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal('Failed to get list of tribes.');
    });
  });

  describe('removePushRegistration', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.removePushRegistration({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('returns 400 when removing a registration fails', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon
        .stub(User, 'findByIdAndUpdate')
        .returns(
          failedQuery(new Error('remove failed')) as unknown as ReturnType<
            typeof User.findByIdAndUpdate
          >,
        );

      const res = deferredResponse();
      profileController.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('uses the default message when removing a registration fails without details', async () => {
      const controller = loadControllerWithEmptyErrorMessage();
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      sinon
        .stub(User, 'findByIdAndUpdate')
        .returns(
          failedQuery({}) as unknown as ReturnType<
            typeof User.findByIdAndUpdate
          >,
        );

      const res = deferredResponse();
      controller.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal(
        'Failed to remove registration, please try again.',
      );
    });

    it('removes a historical registration by token', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      if (!userDoc) throw new Error('expected saved user');
      userDoc.pushRegistration = [{ platform: 'web', token: 'token-1' }];
      await userDoc.save();

      const res = deferredResponse();
      profileController.removePushRegistration(
        { user: { _id: saved._id }, params: { token: 'token-1' } },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      responseMessage(res).should.equal('Removed registration.');

      const reloaded = await User.findById(saved._id);
      if (!reloaded) throw new Error('expected reloaded user');
      reloaded.pushRegistration!.length.should.equal(0);
    });
  });

  describe('addPushRegistration', () => {
    it('responds with 403 when there is no user', async () => {
      const res = deferredResponse();
      profileController.addPushRegistration({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('rejects new registrations because push is retired', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      profileController.addPushRegistration(
        {
          user: { _id: saved._id },
          body: { token: 'token-1', platform: 'web' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseMessage(res).should.equal(
        'Push notifications are no longer available.',
      );

      const reloaded = await User.findById(saved._id);
      if (!reloaded) throw new Error('expected reloaded user');
      reloaded.pushRegistration!.length.should.equal(0);
    });
  });
});
