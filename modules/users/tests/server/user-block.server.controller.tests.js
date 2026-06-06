/**
 * Unit tests for the user block controller error and guard branches.
 *
 * The happy paths are covered by `user-block.server.routes.tests.js`; here we
 * call the controller functions directly so we can exercise the validation
 * guards, the "nothing updated" responses, and the catch blocks that are hard
 * to reach through the HTTP routes.
 */
const mongoose = require('mongoose');

const blockController = require('../../server/controllers/users.block.server.controller');
const errorService = require('../../../core/server/services/error.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

function mockResponse() {
  const res = {
    statusCode: 200,
    body: null,
  };

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    return res;
  };

  return res;
}

describe('User block controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('getBlockedUsers', () => {
    it('sends the populated blocked list', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));

      const res = mockResponse();
      await blockController.getBlockedUsers({ user: { _id: user._id } }, res);

      res.statusCode.should.equal(200);
      res.body.should.be.an.Array();
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
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
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('default'),
      );
    });
  });
});
