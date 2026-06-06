/**
 * Unit tests for reference-thread controller guard and validation branches.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const referenceController = require('../../server/controllers/reference-thread.server.controller');
const statService = require('../../../stats/server/services/stats.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

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

async function createThreadWithMessage(author, other, fromAuthor) {
  const Message = mongoose.model('Message');
  const userFrom = fromAuthor ? author._id : other._id;
  const userTo = fromAuthor ? other._id : author._id;
  const message = await new Message({
    content: 'Thread message',
    userFrom,
    userTo,
  }).save();
  const thread = await new Thread({
    userFrom: author._id,
    userTo: other._id,
    message: message._id,
    read: false,
    updated: Date.now(),
  }).save();
  return { message, thread };
}

describe('Reference thread controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('readReferenceThread', () => {
    it('returns an empty object when no reference is attached', async () => {
      const res = deferredResponse();
      referenceController.readReferenceThread({}, res);
      await res.waitForResponse();
      res.body.should.eql({});
    });

    it('returns the attached reference thread', async () => {
      const res = deferredResponse();
      const referenceThread = { _id: 'ref-1', reference: 'yes' };
      referenceController.readReferenceThread({ referenceThread }, res);
      await res.waitForResponse();
      res.body.should.eql(referenceThread);
    });
  });

  describe('readReferenceThreadById', () => {
    it('responds with 403 without a user', async () => {
      const res = deferredResponse();
      referenceController.readReferenceThreadById(
        {},
        res,
        () => {},
        new mongoose.Types.ObjectId().toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid id', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const res = deferredResponse();
      referenceController.readReferenceThreadById(
        { user },
        res,
        () => {},
        'bad-id',
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('calls next when a reference thread exists', async () => {
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const { thread: messageThread } = await createThreadWithMessage(
        author,
        other,
        false,
      );
      const thread = await new ReferenceThread({
        thread: messageThread._id,
        userFrom: author._id,
        userTo: other._id,
        reference: 'yes',
      }).save();

      const req = { user: author };
      let nextCalled = false;
      await new Promise(resolve => {
        referenceController.readReferenceThreadById(
          req,
          deferredResponse(),
          () => {
            nextCalled = true;
            resolve();
          },
          other._id.toString(),
        );
      });

      nextCalled.should.be.true();
      req.referenceThread._id.toString().should.equal(thread._id.toString());
    });

    it('responds with 404 and allowCreatingReference when messaging is allowed', async () => {
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);

      const res = deferredResponse();
      referenceController.readReferenceThreadById(
        { user: author },
        res,
        () => {},
        other._id.toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(404);
      res.body.allowCreatingReference.should.be.true();
    });

    it('passes database errors to next', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      sinon.stub(ReferenceThread, 'findOne').returns({
        sort: () => ({
          exec: cb => cb(new Error('lookup failed')),
        }),
      });

      let nextArg;
      await new Promise(resolve => {
        referenceController.readReferenceThreadById(
          { user },
          deferredResponse(),
          err => {
            nextArg = err;
            resolve();
          },
          new mongoose.Types.ObjectId().toString(),
        );
      });

      nextArg.should.be.Error();
      nextArg.message.should.equal('lookup failed');
    });
  });

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

    it('creates a reference thread when messaging rules allow it', async () => {
      sinon.stub(statService, 'stat').callsFake((data, cb) => cb());
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);

      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();

      res.body.userFrom.toString().should.equal(author._id.toString());
      res.body.userTo.toString().should.equal(other._id.toString());
      res.body.reference.should.equal('yes');

      const saved = await ReferenceThread.findOne({
        userFrom: author._id,
        userTo: other._id,
      });
      saved.reference.should.equal('yes');
    });

    it('responds with 400 when saving the reference fails', async () => {
      sinon.stub(statService, 'stat').callsFake((data, cb) => cb());
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);
      sinon
        .stub(ReferenceThread.prototype, 'save')
        .callsFake(cb => cb(new Error('save failed')));

      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('responds with 400 when the waterfall fails', async () => {
      sinon.stub(statService, 'stat').callsFake((data, cb) => cb());
      const [author, other] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);
      sinon.stub(User, 'findById').callsFake((id, fields, cb) => {
        const callback = typeof fields === 'function' ? fields : cb;
        callback(new Error('user lookup failed'));
      });

      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects references when the user is not in the thread', async () => {
      const [author, other, stranger] = await utils.saveUsers(
        utils.generateUsers(3, { public: true }),
      );
      sinon.stub(Thread, 'findOne').callsFake((query, fields, cb) => {
        const callback = typeof fields === 'function' ? fields : cb;
        callback(null, {
          _id: new mongoose.Types.ObjectId(),
          userFrom: author._id,
          userTo: other._id,
        });
      });

      const res = deferredResponse();
      referenceController.createReferenceThread(
        {
          user: stranger,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });
  });
});
