/**
 * Unit tests for reference-thread controller guard and validation branches.
 */
const mongoose = require('mongoose');

const referenceController = require('../../server/controllers/reference-thread.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Reference thread controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('createReferenceThread', () => {
    it('responds with 403 without a public user', async () => {
      const res = deferredResponse();
      referenceController.createReferenceThread({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('rejects an invalid userTo id', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const res = deferredResponse();
      referenceController.createReferenceThread(
        { user, body: { userTo: 'bad-id' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects references for non-existing threads', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user,
          body: { userTo: new mongoose.Types.ObjectId().toString() },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Thread does not exist.');
    });

    it('rejects references when the other person has not messaged you', async () => {
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: 'Only from author',
        userFrom: author._id,
        userTo: other._id,
      }).save();
      await new Thread({
        userFrom: author._id,
        userTo: other._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user: author,
          body: { userTo: other._id.toString(), feedback: 'Great guest' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });
  });
});
