/**
 * Unit tests for the user block controller error and guard branches.
 *
 * The happy paths are covered by `user-block.server.routes.tests.js`; here we
 * call the controller functions directly so we can exercise the validation
 * guards, the "nothing updated" responses, and the catch blocks that are hard
 * to reach through the HTTP routes.
 */
const mongoose: typeof import('mongoose') = require('mongoose');

const blockController = require('./../../server/controllers/users.block.server.controller.mjs');
const errorService: typeof import('../../../core/server/services/error.server.service.mjs').default = require('./../../../core/server/services/error.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      return res;
    },
  };

  return res;
}

function messageBody(res: MockResponse): string {
  if (
    typeof res.body !== 'object' ||
    res.body === null ||
    !('message' in res.body) ||
    typeof res.body.message !== 'string'
  ) {
    throw new Error('Expected a message response');
  }
  return res.body.message;
}

describe('User block controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('getBlockedUsers', () => {
    it('sends the populated blocked list', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));

      const res = mockResponse();
      await blockController.getBlockedUsers({ user: { _id: user._id } }, res);

      res.statusCode.should.equal(200);
      if (!Array.isArray(res.body))
        throw new Error('Expected an array response');
      res.body.length.should.equal(0);
    });

    it('responds with 400 when the lookup fails', async () => {
      // A non-existent user id resolves to `null`, so reading `.blocked`
      // throws and the catch block is exercised.
      const res = mockResponse();
      await blockController.getBlockedUsers(
        { user: { _id: new mongoose.Types.ObjectId() } },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });

  describe('blockUser', () => {
    it('responds with 400 when no profile is provided', async () => {
      const res = mockResponse();
      await blockController.blockUser(
        { user: { _id: new mongoose.Types.ObjectId() } },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('responds with 400 when trying to block yourself', async () => {
      const id = new mongoose.Types.ObjectId();
      const res = mockResponse();
      await blockController.blockUser(
        { user: { _id: id }, profile: { _id: id } },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('responds with 404 when the logged in user no longer exists', async () => {
      const res = mockResponse();
      await blockController.blockUser(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          profile: {
            _id: new mongoose.Types.ObjectId(),
            username: 'someone',
          },
        },
        res,
      );

      res.statusCode.should.equal(404);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('responds with 400 when the update throws', async () => {
      const res = mockResponse();
      await blockController.blockUser(
        {
          user: { _id: 'not-a-valid-object-id' },
          profile: {
            _id: new mongoose.Types.ObjectId(),
            username: 'someone',
          },
        },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });

  describe('unblockUser', () => {
    it('responds with 400 when no profile is provided', async () => {
      const res = mockResponse();
      await blockController.unblockUser(
        { user: { _id: new mongoose.Types.ObjectId() }, params: {} },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('responds with 404 when nothing was unblocked', async () => {
      const res = mockResponse();
      await blockController.unblockUser(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          profile: {
            _id: new mongoose.Types.ObjectId(),
            username: 'someone',
          },
          params: { username: 'someone' },
        },
        res,
      );

      res.statusCode.should.equal(404);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('responds with 400 when the update throws', async () => {
      const res = mockResponse();
      await blockController.unblockUser(
        {
          user: { _id: 'not-a-valid-object-id' },
          profile: {
            _id: new mongoose.Types.ObjectId(),
            username: 'someone',
          },
          params: { username: 'someone' },
        },
        res,
      );

      res.statusCode.should.equal(400);
      messageBody(res).should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });
});
