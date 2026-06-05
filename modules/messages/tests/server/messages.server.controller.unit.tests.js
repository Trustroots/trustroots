/**
 * Unit tests for the messages controller guard, validation and error
 * branches that the higher-level route tests do not reach. Handlers are
 * called directly with mock req/res objects against the test database.
 */
const mongoose = require('mongoose');

const messagesController = require('../../server/controllers/messages.server.controller');
const config = require('../../../../config/config');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');

/**
 * Response mock that resolves a promise when the controller responds, so both
 * synchronous guards and async waterfalls can be awaited.
 */
function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });

  const res = { statusCode: 200, body: null, links: () => res };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Messages controller unit tests', () => {
  afterEach(utils.clearDatabase);

  describe('guards require an authenticated user', () => {
    it('inbox responds with 403', async () => {
      const res = deferredResponse();
      messagesController.inbox({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('send responds with 403', async () => {
      const res = deferredResponse();
      messagesController.send({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('markRead responds with 403', async () => {
      const res = deferredResponse();
      messagesController.markRead({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('messagesCount responds with 403', async () => {
      const res = deferredResponse();
      messagesController.messagesCount({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('sync responds with 403', async () => {
      const res = deferredResponse();
      messagesController.sync({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('threadByUser responds with 403', async () => {
      const res = deferredResponse();
      messagesController.threadByUser({}, res, () => {}, 'x');
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });
  });

  describe('send validation', () => {
    let sender;

    beforeEach(async () => {
      [sender] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      sender.roles = ['user'];
    });

    it('requires a userTo field', async () => {
      const res = deferredResponse();
      messagesController.send({ user: sender, body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Missing `userTo` field.');
    });

    it('rejects an invalid userTo id', async () => {
      const res = deferredResponse();
      messagesController.send(
        { user: sender, body: { userTo: 'not-an-id' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects messaging yourself', async () => {
      const res = deferredResponse();
      messagesController.send(
        { user: sender, body: { userTo: sender._id.toString() } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('requires message content', async () => {
      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: { userTo: new mongoose.Types.ObjectId().toString() },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Please write a message.');
    });

    it('returns 404 when the recipient does not exist', async () => {
      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: new mongoose.Types.ObjectId().toString(),
            content: 'Hello there friend',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(404);
    });

    it('rejects a first message from an empty profile', async () => {
      const [receiver] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello there friend',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.error.should.equal('empty-profile');
    });

    it('throttles users who message too many people', async () => {
      const throttle = config.limits.messagesToIndividualsThrottle;
      const originalCount = throttle.count;
      throttle.count = -1;
      try {
        const res = deferredResponse();
        messagesController.send(
          {
            user: sender,
            body: {
              userTo: new mongoose.Types.ObjectId().toString(),
              content: 'Hello there friend',
            },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(429);
      } finally {
        throttle.count = originalCount;
      }
    });

    it('sends a message successfully', async () => {
      const senderDoc = await User.findById(sender._id);
      senderDoc.description =
        'I am a long-time member of this community and I love to travel and host people from all over the world. ' +
        'I enjoy cooking, cycling, hiking and sharing stories with travellers passing through my town.';
      await senderDoc.save();

      const [receiver] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );

      const res = deferredResponse();
      messagesController.send(
        {
          user: senderDoc,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello there, would love to host you!',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.content.should.containEql('Hello there');
    });
  });

  describe('threadByUser validation', () => {
    it('rejects an invalid user id', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.threadByUser({ user }, res, () => {}, 'not-an-id');
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('thread', () => {
    it('returns sanitized messages', () => {
      const res = deferredResponse();
      messagesController.thread(
        { messages: [{ content: '<b>hi</b><script>x</script>' }] },
        res,
      );
      res.body.should.be.an.Array();
      res.body[0].content.should.equal('<b>hi</b>');
    });

    it('returns an empty array without messages', () => {
      const res = deferredResponse();
      messagesController.thread({}, res);
      res.body.should.deepEqual([]);
    });
  });

  describe('sync date validation', () => {
    let user;

    beforeEach(async () => {
      [user] = await utils.saveUsers(utils.generateUsers(1));
    });

    it('rejects an invalid dateFrom', async () => {
      const res = deferredResponse();
      messagesController.sync({ user, query: { dateFrom: 'nonsense' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Invalid `dateFrom`.');
    });

    it('rejects an invalid dateTo', async () => {
      const res = deferredResponse();
      messagesController.sync(
        { user, query: { dateFrom: '2020-01-01', dateTo: 'nonsense' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Invalid `dateTo`.');
    });

    it('rejects dateFrom later than dateTo', async () => {
      const res = deferredResponse();
      messagesController.sync(
        { user, query: { dateFrom: '2021-01-01', dateTo: '2020-01-01' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.containEql('cannot be later');
    });

    it('returns data for a valid date range', async () => {
      const res = deferredResponse();
      messagesController.sync(
        { user, query: { dateFrom: '2020-01-01', dateTo: '2021-01-01' } },
        res,
      );
      await res.waitForResponse();
      res.body.should.have.property('messages');
      res.body.should.have.property('users');
    });
  });

  describe('markAllMessagesToUserNotified', () => {
    it('updates without error for a user with no messages', done => {
      messagesController.markAllMessagesToUserNotified(
        new mongoose.Types.ObjectId(),
        err => {
          (err === null || err === undefined).should.be.true();
          done();
        },
      );
    });
  });

  describe('sanitizeMessages', () => {
    it('returns an empty array for missing input', () => {
      messagesController.sanitizeMessages(null).should.deepEqual([]);
      messagesController.sanitizeMessages([]).should.deepEqual([]);
    });
  });

  describe('markRead', () => {
    it('marks messages as read', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const message = await new Message({
        content: 'Unread hello',
        userFrom: sender._id,
        userTo: receiver._id,
        read: false,
      }).save();

      const res = deferredResponse();
      messagesController.markRead(
        {
          user: { _id: receiver._id, id: receiver._id.toString() },
          body: { messageIds: [message._id.toString()] },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);

      const reloaded = await Message.findById(message._id);
      reloaded.read.should.be.true();
    });
  });

  describe('messagesCount', () => {
    it('returns zero for a user with no unread threads', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.messagesCount({ user: { _id: user._id } }, res);
      await res.waitForResponse();
      res.body.unread.should.equal(0);
    });
  });

  describe('inbox', () => {
    it('returns an empty inbox', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.inbox({ user: { _id: user._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.deepEqual([]);
    });

    it('returns sanitized threads for the inbox', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: '<b>Hello</b> there',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: receiver._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.be.an.Array().with.lengthOf(1);
      res.body[0].message.excerpt.should.containEql('Hello');
    });

    it('marks threads read when the latest message was sent by the viewer', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: 'My own message',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: sender._id }, query: {} }, res);
      await res.waitForResponse();
      res.body[0].read.should.be.true();
    });
  });

  describe('threadByUser middleware', () => {
    function runThreadByUser(req, userId) {
      return new Promise(resolve => {
        const res = { statusCode: 200, body: null, links: () => res };
        const finish = nextCalled => resolve({ res, nextCalled, req });
        res.status = code => {
          res.statusCode = code;
          return res;
        };
        res.send = body => {
          res.body = body;
          finish(false);
          return res;
        };
        res.json = body => {
          res.body = body;
          finish(false);
          return res;
        };
        messagesController.threadByUser(req, res, () => finish(true), userId);
      });
    }

    it('loads messages and marks the thread read', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: 'Unread thread message',
        userFrom: sender._id,
        userTo: receiver._id,
        read: false,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const { nextCalled, req } = await runThreadByUser(
        { user: receiver, query: {} },
        sender._id.toString(),
      );
      nextCalled.should.be.true();
      req.messages.should.be.an.Array().with.lengthOf(1);
      const thread = await Thread.findOne({
        userFrom: sender._id,
        userTo: receiver._id,
      });
      thread.read.should.be.true();
    });

    it('skips marking read when the latest message was sent by the viewer', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: 'Sent by viewer',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const { nextCalled } = await runThreadByUser(
        { user: sender, query: {} },
        receiver._id.toString(),
      );
      nextCalled.should.be.true();
    });
  });

  describe('send follow-up messages', () => {
    const longDescription =
      'I am a long-time member of this community and I love to travel and host people from all over the world. ' +
      'I enjoy cooking, cycling, hiking and sharing stories with travellers passing through my town.';

    async function prepareSender() {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const senderDoc = await User.findById(sender._id);
      senderDoc.description = longDescription;
      senderDoc.roles = ['user'];
      await senderDoc.save();
      return { sender: senderDoc, receiver };
    }

    it('allows a follow-up message in an existing thread', async () => {
      const { sender, receiver } = await prepareSender();
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const first = await new Message({
        content: 'First hello',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: first._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Second hello',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.content.should.containEql('Second hello');
    });

    it('rejects a profile that is too short but not empty', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const senderDoc = await User.findById(sender._id);
      senderDoc.description = 'Too short.';
      await senderDoc.save();

      const res = deferredResponse();
      messagesController.send(
        {
          user: senderDoc,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello there friend',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.containEql('longer profile description');
    });

    it('does not let regular users message suspended members', async () => {
      const { sender, receiver } = await prepareSender();
      const receiverDoc = await User.findById(receiver._id);
      receiverDoc.roles = ['user', 'suspended'];
      await receiverDoc.save();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello suspended user',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(404);
    });

    it('shadow-hides messages from restricted senders', async () => {
      const { sender, receiver } = await prepareSender();
      sender.roles = ['user', 'shadowban'];
      await sender.save();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hidden from recipient',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);

      const Message = mongoose.model('Message');
      const saved = await Message.findOne({ userFrom: sender._id }).sort({
        created: -1,
      });
      saved.shadowHidden.should.be.true();
      saved.read.should.be.true();
    });
  });

  describe('sync with messages', () => {
    it('groups messages and returns related users', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      await new Message({
        content: 'Sync test message',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();

      const res = deferredResponse();
      messagesController.sync({ user: receiver, query: {} }, res);
      await res.waitForResponse();
      res.body.users.should.be.an.Array().with.lengthOf(2);
      Object.keys(res.body.messages).length.should.be.aboveOrEqual(1);
    });
  });

  describe('messagesCount with unread threads', () => {
    it('returns the unread thread count', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const Message = mongoose.model('Message');
      const Thread = mongoose.model('Thread');
      const message = await new Message({
        content: 'Unread',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      messagesController.messagesCount({ user: { _id: receiver._id } }, res);
      await res.waitForResponse();
      res.body.unread.should.equal(1);
    });
  });

  describe('sanitizeMessages with content', () => {
    it('strips unsafe html from message content', () => {
      const cleaned = messagesController.sanitizeMessages([
        { content: '<b>hi</b><script>x</script>' },
      ]);
      cleaned[0].content.should.equal('<b>hi</b>');
    });
  });
});
