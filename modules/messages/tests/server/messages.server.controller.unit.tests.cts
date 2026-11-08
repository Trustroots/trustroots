/**
 * Unit tests for the messages controller guard, validation and error
 * branches that the higher-level route tests do not reach. Handlers are
 * called directly with mock req/res objects against the test database.
 */
import type { QueryFilter, UpdateQuery } from 'mongoose';
import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  ThreadModel,
  ThreadRecord,
  UserDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

type LegacyCallback<T = unknown> = (error: Error | null, result?: T) => void;
type PaginationPayload = {
  docs: object[] | null;
  pages?: number;
  total?: number;
};

const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const messagesController: typeof import('../../server/controllers/messages.server.controller.mjs').default = require('./../../server/controllers/messages.server.controller.mjs');
interface ControllerTestConfig {
  limits: { messagesToIndividualsThrottle: { count: number } };
  https: boolean;
}
const config: ControllerTestConfig = require('./../../../../config/config.mts');
const messageStatService = require('./../../server/services/message-stat.server.service.mjs');
const messageThrottleAlerts =
  require('../../server/services/message-throttle-alert.server.service.mts')
    .default as typeof import('../../server/services/message-throttle-alert.server.service.mts').default;
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User') as unknown as UserModel;
const Thread = mongoose.model('Thread') as ThreadModel;
type MessagePaginationResult = {
  docs: MessageDocument[];
  pages: number;
  total: number;
};
type MessageTestModel = MessageModel & {
  paginate(
    query: QueryFilter<MessageRecord>,
    options: { page: number; limit: number; sort?: Record<string, 1 | -1> },
  ): Promise<MessagePaginationResult>;
};
const Message = mongoose.model('Message') as unknown as MessageTestModel;

function typedStub<TArgs extends readonly unknown[]>(
  target: object,
  method: string,
): import('sinon').SinonStub<TArgs, unknown> {
  const methods = target as Record<string, (...args: TArgs) => unknown>;
  return sinon.stub(methods, method) as unknown as import('sinon').SinonStub<
    TArgs,
    unknown
  >;
}

/**
 * Response mock that resolves a promise when the controller responds, so both
 * synchronous guards and async waterfalls can be awaited.
 */
interface DeferredResponse {
  statusCode: number;
  body: object;
  locals?: { paginate?: { href(input: { page: number }): string } };
  linkHeader?: { next?: string };
  links(links?: { next?: string }): DeferredResponse;
  status(code: number): DeferredResponse;
  send(body: object): DeferredResponse;
  json(body: object): DeferredResponse;
  waitForResponse(): Promise<DeferredResponse>;
}

function bodyField<T>(body: object, field: string): T {
  return (body as Record<string, unknown>)[field] as T;
}

function bodyArray<T>(body: object): T[] {
  return body as T[];
}

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error('Expected value');
  return value as NonNullable<T>;
}

function deferredResponse(): DeferredResponse {
  let resolveResponse: (response: DeferredResponse) => void;
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });

  const res = {
    statusCode: 200,
    body: {},
    links: () => res,
  } as DeferredResponse;
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body: object) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = function (body: object) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Messages controller unit tests', () => {
  describe('draft previews', () => {
    it('requires authentication', () => {
      const res = deferredResponse();
      messagesController.preview({}, res);
      res.statusCode.should.equal(403);
    });

    for (const content of [undefined, null, 7, {}, '', '<p> </p>']) {
      it(`rejects invalid draft content: ${JSON.stringify(content)}`, () => {
        const res = deferredResponse();
        messagesController.preview({ user: {}, body: { content } }, res);
        res.statusCode.should.equal(400);
      });
    }

    it('rejects a missing body', () => {
      const res = deferredResponse();
      messagesController.preview({ user: {} }, res);
      res.statusCode.should.equal(400);
    });

    it('formats and sanitises a draft without altering messages, threads or statistics', async () => {
      const res = deferredResponse();
      const content =
        '<p><strong>Fictional draft</strong> <a href="javascript:alert(1)">Link</a></p><script>alert(1)</script>';
      const { default: textService } =
        await import('../../../core/server/services/text.server.service.mts');
      const messageBefore = await Message.find({}).lean();
      const threadBefore = await Thread.find({}).lean();
      const statsBefore = await mongoose.model('MessageStat').find({}).lean();
      messagesController.preview({ user: {}, body: { content } }, res);
      bodyField<string>(res.body, 'content').should.equal(
        textService.html(content),
      );
      bodyField<string>(res.body, 'content').should.containEql(
        '<b>Fictional draft</b>',
      );
      bodyField<string>(res.body, 'content').should.not.containEql('<script');
      bodyField<string>(res.body, 'content').should.not.containEql(
        'javascript:',
      );
      (await Message.find({}).lean()).should.deepEqual(messageBefore);
      (await Thread.find({}).lean()).should.deepEqual(threadBefore);
      (await mongoose.model('MessageStat').find({}).lean()).should.deepEqual(
        statsBefore,
      );
    });
  });
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  it('paginates stored messages with the existing Mongoose plugin', async () => {
    const [sender, recipient] = await utils.saveUsers(
      utils.generateUsers(2, { public: true }),
    );
    await Message.create(
      [1, 2, 3].map(sequence => ({
        userFrom: sender._id,
        userTo: recipient._id,
        content: `Anonymous message ${sequence}`,
        created: new Date(Date.UTC(2020, 0, sequence)),
      })),
    );

    const page = await Message.paginate(
      { userFrom: sender._id },
      { page: 2, limit: 1, sort: { created: -1 } },
    );

    page.total.should.equal(3);
    page.pages.should.equal(3);
    page.docs.length.should.equal(1);
    page.docs[0].content!.should.equal('Anonymous message 2');
  });

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
    let sender: UserDocument;
    let notify: import('sinon').SinonStub;

    beforeEach(async () => {
      [sender] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      sender.roles = ['user'];
      notify = sinon.stub(messageThrottleAlerts, 'notify').resolves();
    });

    it('requires a userTo field', async () => {
      const res = deferredResponse();
      messagesController.send({ user: sender, body: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      bodyField<string>(res.body, 'message').should.equal(
        'Missing `userTo` field.',
      );
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
      bodyField<string>(res.body, 'message').should.equal(
        'Please write a message.',
      );
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
      notify.called.should.equal(false);
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
      bodyField<string>(res.body, 'error').should.equal('empty-profile');
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
        notify.calledOnceWithExactly(sender, 0).should.equal(true);
      } finally {
        throttle.count = originalCount;
      }
    });

    it('retains HTTP 429 when throttle notification fails', async () => {
      sinon
        .stub(Message, 'distinct')
        .resolves(
          Array.from(
            { length: config.limits.messagesToIndividualsThrottle.count + 1 },
            () => new mongoose.Types.ObjectId(),
          ),
        );
      notify.rejects(new Error('Notification unavailable'));
      const res = deferredResponse();
      await messagesController.send(
        {
          user: sender,
          body: {
            userTo: new mongoose.Types.ObjectId().toString(),
            content: 'A fictional greeting.',
          },
        },
        res,
      );
      res.statusCode.should.equal(429);
      bodyField<string>(res.body, 'message').should.equal(
        'You are writing too many messages.',
      );
    });

    for (const role of ['welcome-team', 'admin']) {
      it(`exempts ${role} from throttling while retaining recipient validation`, async () => {
        sender.roles = ['user', role];
        const distinct = sinon
          .stub(Message, 'distinct')
          .resolves(
            Array.from(
              { length: config.limits.messagesToIndividualsThrottle.count + 1 },
              () => new mongoose.Types.ObjectId(),
            ),
          );
        const res = deferredResponse();
        await messagesController.send(
          {
            user: sender,
            body: {
              userTo: new mongoose.Types.ObjectId().toString(),
              content: 'Welcome to the community.',
            },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(404);
        distinct.called.should.equal(false);
        notify.called.should.equal(false);

        sender.roles = ['user'];
        const revokedResponse = deferredResponse();
        await messagesController.send(
          {
            user: sender,
            body: {
              userTo: new mongoose.Types.ObjectId().toString(),
              content: 'Welcome to the community.',
            },
          },
          revokedResponse,
        );
        await revokedResponse.waitForResponse();
        revokedResponse.statusCode.should.equal(429);
        distinct.calledOnce.should.equal(true);
      });
    }

    it('sends a message successfully', async () => {
      const senderDoc = required(await User.findById(sender._id));
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
      bodyField<string>(res.body, 'content').should.containEql('Hello there');
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
      bodyArray<{ content: string }>(res.body)[0].content.should.equal(
        '<b>hi</b>',
      );
    });

    it('returns an empty array without messages', () => {
      const res = deferredResponse();
      messagesController.thread({}, res);
      res.body.should.deepEqual([]);
    });
  });

  describe('sync date validation', () => {
    let user: UserDocument;

    beforeEach(async () => {
      [user] = await utils.saveUsers(utils.generateUsers(1));
    });

    it('rejects an invalid dateFrom', async () => {
      const res = deferredResponse();
      messagesController.sync({ user, query: { dateFrom: 'nonsense' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      bodyField<string>(res.body, 'message').should.equal(
        'Invalid `dateFrom`.',
      );
    });

    it('rejects an invalid dateTo', async () => {
      const res = deferredResponse();
      messagesController.sync(
        { user, query: { dateFrom: '2020-01-01', dateTo: 'nonsense' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      bodyField<string>(res.body, 'message').should.equal('Invalid `dateTo`.');
    });

    it('rejects dateFrom later than dateTo', async () => {
      const res = deferredResponse();
      messagesController.sync(
        { user, query: { dateFrom: '2021-01-01', dateTo: '2020-01-01' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      bodyField<string>(res.body, 'message').should.containEql(
        'cannot be later',
      );
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
        new mongoose.Types.ObjectId().toString(),
        (err: Error | null) => {
          (err === null || err === undefined).should.be.true();
          done();
        },
      );
    });

    it('marks every message to the user without changing other recipients', async () => {
      const [sender, recipient, otherRecipient] = await utils.saveUsers(
        utils.generateUsers(3, { public: true }),
      );
      await Message.create([
        {
          userFrom: sender._id,
          userTo: recipient._id,
          content: 'First message',
        },
        {
          userFrom: sender._id,
          userTo: recipient._id,
          content: 'Second message',
        },
        {
          userFrom: sender._id,
          userTo: otherRecipient._id,
          content: 'Other message',
        },
      ]);

      await new Promise<void>((resolve, reject) => {
        messagesController.markAllMessagesToUserNotified(
          recipient._id.toString(),
          (err: Error | null) => (err ? reject(err) : resolve()),
        );
      });

      const messages = await Message.find().sort('content');
      const recipientMessages = messages.filter(message =>
        required(message.userTo).equals(recipient._id),
      );
      const otherMessages = messages.filter(message =>
        required(message.userTo).equals(otherRecipient._id),
      );
      recipientMessages.length.should.equal(2);
      recipientMessages
        .every(message => message.notificationCount === 2)
        .should.be.true();
      otherMessages
        .every(message => message.notificationCount === 0)
        .should.be.true();
    });
  });

  describe('sanitizeMessages', () => {
    it('returns an empty array for missing input', () => {
      const sanitizeMessages = messagesController.sanitizeMessages as (
        input: MessageRecord[] | null,
      ) => MessageRecord[];
      sanitizeMessages(null).should.deepEqual([]);
      sanitizeMessages([]).should.deepEqual([]);
    });
  });

  describe('markRead', () => {
    for (const messageIds of [
      undefined,
      null,
      'invalid',
      [null],
      [1],
      [{}],
      [{ $ne: null }],
      ['invalid'],
      ['abcdefghijklmnopqrstuvwx'],
    ]) {
      it(`rejects invalid message identifiers ${JSON.stringify(
        messageIds,
      )}`, async () => {
        const update = sinon.spy(Message, 'updateMany');
        const res = deferredResponse();
        messagesController.markRead(
          {
            user: { _id: new mongoose.Types.ObjectId() },
            body: { messageIds },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(400);
        update.called.should.be.false();
      });
    }

    it('rejects a missing body and accepts an empty acknowledgement', async () => {
      const user = { _id: new mongoose.Types.ObjectId() };
      const missing = deferredResponse();
      messagesController.markRead({ user }, missing);
      await missing.waitForResponse();
      missing.statusCode.should.equal(400);
      const empty = deferredResponse();
      messagesController.markRead({ user, body: { messageIds: [] } }, empty);
      await empty.waitForResponse();
      empty.statusCode.should.equal(200);
    });

    it('acknowledges only the recipient’s threads whose latest message is read', async () => {
      const [sender, receiver, stranger] = await utils.saveUsers(
        utils.generateUsers(3, { public: true }),
      );
      const messages = await Message.create([
        {
          content: 'Earlier hello',
          userFrom: sender._id,
          userTo: receiver._id,
        },
        { content: 'Latest hello', userFrom: sender._id, userTo: receiver._id },
        {
          content: 'Separate hello',
          userFrom: sender._id,
          userTo: stranger._id,
        },
      ]);
      const threads = await Thread.create([
        {
          userFrom: sender._id,
          userTo: receiver._id,
          message: messages[1]._id,
          read: false,
        },
        {
          userFrom: sender._id,
          userTo: stranger._id,
          message: messages[2]._id,
          read: false,
        },
      ]);
      const acknowledge = async (ids: import('mongoose').Types.ObjectId[]) => {
        const res = deferredResponse();
        messagesController.markRead(
          {
            user: receiver,
            body: { messageIds: ids.map(id => id.toString()) },
          },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(200);
      };
      await acknowledge([messages[0]._id]);
      required(await Thread.findById(threads[0]._id)).read!.should.be.false();
      await acknowledge([messages[1]._id, messages[2]._id]);
      required(await Thread.findById(threads[0]._id)).read!.should.be.true();
      required(await Thread.findById(threads[1]._id)).read!.should.be.false();
      required(await Message.findById(messages[2]._id)).read!.should.be.false();
    });

    it('returns 400 when thread acknowledgement fails', async () => {
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          update: UpdateQuery<ThreadRecord>,
          callback: LegacyCallback,
        ]
      >(Thread, 'updateMany').callsFake((query, update, callback) => {
        callback(new Error('Thread update failed'));
      });
      const [receiver] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.markRead(
        {
          user: receiver,
          body: { messageIds: [new mongoose.Types.ObjectId().toString()] },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
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

      const reloaded = required(await Message.findById(message._id));
      reloaded.read.should.be.true();
    });

    it('does not mark another member’s incoming message as read', async () => {
      const [sender, receiver, stranger] = await utils.saveUsers(
        utils.generateUsers(3, { public: true }),
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
          user: { _id: stranger._id, id: stranger._id.toString() },
          body: { messageIds: [message._id.toString()] },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);

      const reloaded = required(await Message.findById(message._id));
      reloaded.read.should.be.false();
    });
  });

  describe('messagesCount', () => {
    it('returns zero for a user with no unread threads', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.messagesCount({ user: { _id: user._id } }, res);
      await res.waitForResponse();
      bodyField<number>(res.body, 'unread').should.equal(0);
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
      bodyArray<{ message: { excerpt: string } }>(
        res.body,
      )[0].message.excerpt.should.containEql('Hello');
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
      bodyArray<{ read: boolean }>(res.body)[0].read.should.be.true();
    });

    it('shows exactly the threads counted as unread', async () => {
      const [viewer, sender, other] = await utils.saveUsers(
        utils.generateUsers(3, { public: true }),
      );
      const messages = await Message.create([
        {
          content: 'Unread conversation',
          userFrom: sender._id,
          userTo: viewer._id,
        },
        {
          content: 'Read conversation',
          userFrom: other._id,
          userTo: viewer._id,
        },
        {
          content: 'Sent conversation',
          userFrom: viewer._id,
          userTo: other._id,
        },
      ]);
      await Thread.create([
        {
          userFrom: sender._id,
          userTo: viewer._id,
          message: messages[0]._id,
          read: false,
        },
        {
          userFrom: other._id,
          userTo: viewer._id,
          message: messages[1]._id,
          read: true,
        },
        {
          userFrom: viewer._id,
          userTo: other._id,
          message: messages[2]._id,
          read: false,
        },
      ]);

      const count = deferredResponse();
      messagesController.messagesCount({ user: viewer }, count);
      await count.waitForResponse();

      const inbox = deferredResponse();
      messagesController.inbox(
        { user: viewer, query: { filter: 'unread' } },
        inbox,
      );
      await inbox.waitForResponse();

      bodyField<number>(count.body, 'unread').should.equal(1);
      inbox.body.should.be.an.Array().with.lengthOf(1);
      bodyArray<{ message: { excerpt: string } }>(
        inbox.body,
      )[0].message.excerpt.should.equal('Unread conversation');
    });
  });

  describe('threadByUser middleware', () => {
    interface ThreadByUserRequest {
      user?: UserDocument;
      query: Record<string, unknown>;
      messages?: object[];
    }
    interface ThreadByUserResult {
      res: DeferredResponse;
      nextCalled: boolean;
      req: ThreadByUserRequest;
    }
    function runThreadByUser(
      req: ThreadByUserRequest,
      userId: string,
      markThreadRead = false,
    ): Promise<ThreadByUserResult> {
      return new Promise<ThreadByUserResult>(resolve => {
        const res = deferredResponse();
        const finish = (nextCalled: boolean) =>
          resolve({ res, nextCalled, req });
        res.status = (code: number) => {
          res.statusCode = code;
          return res;
        };
        res.send = (body: object) => {
          res.body = body;
          finish(false);
          return res;
        };
        res.json = (body: object) => {
          res.body = body;
          finish(false);
          return res;
        };
        messagesController.threadByUser(
          req,
          res,
          () => finish(true),
          userId,
          markThreadRead,
        );
      });
    }

    it('loads messages without changing message or thread read state', async () => {
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
      req.messages!.should.be.an.Array().with.lengthOf(1);
      const thread = required(
        await Thread.findOne({
          userFrom: sender._id,
          userTo: receiver._id,
        }),
      );
      thread.read.should.be.false();
      required(await Message.findById(message._id)).read.should.be.false();
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
        true,
      );
      nextCalled.should.be.true();
    });

    it('acknowledges received messages only when mobile reading is requested', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const message = await Message.create({
        content: 'A fictional mobile conversation',
        userFrom: sender._id,
        userTo: receiver._id,
        read: false,
      });
      const thread = await Thread.create({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: new Date(),
      });

      const { nextCalled } = await runThreadByUser(
        { user: receiver, query: {} },
        sender._id.toString(),
        true,
      );

      nextCalled.should.be.true();
      required(await Message.findById(message._id)).read!.should.be.true();
      required(await Thread.findById(thread._id)).read!.should.be.true();
    });

    it('returns an acknowledgement failure without continuing to the thread response', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await Message.create({
        content: 'A fictional unread message',
        userFrom: sender._id,
        userTo: receiver._id,
        read: false,
      });
      sinon
        .stub(Message, 'updateMany')
        .rejects(new Error('Read update failed'));

      const { nextCalled, res } = await runThreadByUser(
        { user: receiver, query: {} },
        sender._id.toString(),
        true,
      );

      nextCalled.should.be.false();
      res.statusCode.should.equal(400);
    });

    it('can load sent messages after the recipient has been removed', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await Message.create({
        content: 'A fictional saved conversation',
        userFrom: sender._id,
        userTo: receiver._id,
        read: false,
      });
      await User.deleteOne({ _id: receiver._id });

      const { nextCalled } = await runThreadByUser(
        { user: sender, query: {} },
        receiver._id.toString(),
        true,
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
      const senderDoc = required(await User.findById(sender._id));
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
      bodyField<string>(res.body, 'content').should.containEql('Second hello');
    });

    it('rejects a profile that is too short but not empty', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const senderDoc = required(await User.findById(sender._id));
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
      bodyField<string>(res.body, 'message').should.containEql(
        'longer profile description',
      );
    });

    it('does not let regular users message suspended members', async () => {
      const { sender, receiver } = await prepareSender();
      const receiverDoc = required(await User.findById(receiver._id));
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

    it('lets admins message suspended members', async () => {
      const { sender, receiver } = await prepareSender();
      sender.roles = ['user', 'admin'];
      await sender.save();
      const receiverDoc = required(await User.findById(receiver._id));
      receiverDoc.roles = ['user', 'suspended'];
      await receiverDoc.save();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello suspended member from admin',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      bodyField<string>(res.body, 'content').should.containEql(
        'Hello suspended member',
      );
    });

    it('returns 404 when recipient lookup errors', async () => {
      const { sender, receiver } = await prepareSender();
      typedStub<[query?: QueryFilter<UserRecord>]>(User, 'findOne').returns({
        exec: () => Promise.reject(new Error('recipient lookup failed')),
      });

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello unreachable member',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(404);
    });

    it('returns 400 when thread upsert fails', async () => {
      const { sender, receiver } = await prepareSender();
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          update: UpdateQuery<ThreadRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback,
        ]
      >(Thread, 'updateOne').callsFake(() =>
        Promise.reject(new Error('thread upsert failed')),
      );

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'Hello without thread write',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('shadow-hides messages from restricted senders', async () => {
      const { sender, receiver } = await prepareSender();
      sender.roles = ['user', 'shadowban'];
      await sender.save();
      const updateMessageStat = sinon.stub(
        messageStatService,
        'updateMessageStat',
      );

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
      const saved = required(
        await Message.findOne({ userFrom: sender._id }).sort({
          created: -1,
        }),
      );
      saved.shadowHidden.should.be.true();
      saved.read.should.be.true();
      sinon.assert.notCalled(updateMessageStat);
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
      bodyField<object[]>(res.body, 'users')
        .should.be.an.Array()
        .with.lengthOf(2);
      Object.keys(
        bodyField<Record<string, Array<{ content?: string }>>>(
          res.body,
          'messages',
        ),
      ).length.should.be.aboveOrEqual(1);
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
      bodyField<number>(res.body, 'unread').should.equal(1);
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

  describe('error paths', () => {
    it('returns 400 when inbox pagination fails', async () => {
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Thread, 'paginate').callsFake((query, options, cb) => {
        cb(new Error('paginate failed'));
      });
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.inbox({ user: { _id: user._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('uses excerpt fallback when the thread message is missing', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const message = await new Message({
        content: 'Will be deleted',
        userFrom: sender._id,
        userTo: receiver._id,
      }).save();
      const thread = await new Thread({
        userFrom: sender._id,
        userTo: receiver._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();
      await Message.deleteOne({ _id: message._id });

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: receiver._id }, query: {} }, res);
      await res.waitForResponse();
      bodyArray<{ message: { excerpt: string } }>(
        res.body,
      )[0].message.excerpt.should.equal('…');
      thread._id.should.be.ok();
    });

    it('returns 400 when markRead update fails', async () => {
      typedStub<
        [
          query: QueryFilter<MessageRecord>,
          update: UpdateQuery<MessageRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback,
        ]
      >(Message, 'updateMany').callsFake(() =>
        Promise.reject(new Error('update failed')),
      );
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.markRead(
        {
          user: { id: user._id.toString(), _id: user._id },
          body: { messageIds: [new mongoose.Types.ObjectId().toString()] },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when messagesCount lookup fails', async () => {
      typedStub<
        [query: QueryFilter<ThreadRecord>, callback: LegacyCallback<number>]
      >(Thread, 'countDocuments').callsFake(() =>
        Promise.reject(new Error('count failed')),
      );
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.messagesCount({ user: { _id: user._id } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when sync message lookup fails', async () => {
      typedStub<[query?: QueryFilter<MessageRecord>]>(Message, 'find').returns({
        sort: () => ({
          select: () => ({
            exec: () => Promise.reject(new Error('find failed')),
          }),
        }),
      });
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      const res = deferredResponse();
      messagesController.sync({ user, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when threadByUser pagination fails', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      typedStub<
        [
          query: QueryFilter<MessageRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Message, 'paginate').callsFake((query, options, cb) => {
        cb(new Error('paginate failed'));
      });

      const res = deferredResponse();
      messagesController.threadByUser(
        { user: receiver, query: {} },
        res,
        () => {},
        sender._id.toString(),
      );
      const response = await res.waitForResponse();
      response.statusCode.should.equal(400);
    });
  });

  describe('uncovered controller paths', () => {
    const longDescription =
      'I am a long-time member of this community and I love to travel and host people from all over the world. ' +
      'I enjoy cooking, cycling, hiking and sharing stories with travellers passing through my town.';

    async function prepareSender() {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const senderDoc = required(await User.findById(sender._id));
      senderDoc.description = longDescription;
      senderDoc.roles = ['user'];
      await senderDoc.save();
      return { sender: senderDoc, receiver };
    }

    it('backfills deleted profile ids in inbox threads', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const message = await new Message({
        content: 'Hello before deletion',
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
      await User.deleteOne({ _id: sender._id });

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: receiver._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.be.an.Array().with.lengthOf(1);
      bodyArray<{ userFrom: { _id: { toString(): string } } }>(res.body)[0]
        .userFrom._id.toString()
        .should.equal(sender._id.toString());
    });

    it('backfills deleted recipient ids in inbox threads', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const message = await new Message({
        content: 'Hello deleted recipient',
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
      await User.deleteOne({ _id: receiver._id });

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: sender._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.be.an.Array().with.lengthOf(1);
      bodyArray<{ userTo: { _id: { toString(): string } } }>(res.body)[0]
        .userTo._id.toString()
        .should.equal(receiver._id.toString());
    });

    it('adds a next page link and excerpt fallback for empty thread messages', async () => {
      const originalHttps = config.https;
      config.https = true;
      const viewerId = new mongoose.Types.ObjectId();
      const otherId = new mongoose.Types.ObjectId();
      const threadId = new mongoose.Types.ObjectId();
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Thread, 'paginate').callsFake((query, options, cb) => {
        cb(null, {
          docs: [
            {
              _id: threadId,
              message: { content: '' },
              read: false,
              userFrom: { _id: viewerId },
              userTo: { _id: otherId },
              toObject() {
                return {
                  _id: threadId,
                  message: { content: '' },
                  read: false,
                  userFrom: { _id: viewerId },
                  userTo: { _id: otherId },
                };
              },
            },
          ],
          pages: 2,
        });
      });

      try {
        const res = deferredResponse();
        res.locals = {
          paginate: {
            href: ({ page }) => `/api/messages?page=${page}`,
          },
        };
        res.links = links => {
          res.linkHeader = links;
          return res;
        };

        messagesController.inbox(
          { user: { _id: viewerId }, query: { page: 1, limit: 1 } },
          res,
        );
        await res.waitForResponse();
        res.statusCode.should.equal(200);
        res.linkHeader!.next!.should.containEql('https://');
        res.linkHeader!.next!.should.containEql('page=2');
        bodyArray<{ message: { excerpt: string } }>(
          res.body,
        )[0].message.excerpt.should.equal('…');
      } finally {
        config.https = originalHttps;
      }
    });

    it('keeps deleted profile fields empty when backfill lookup errors', async () => {
      const viewerId = new mongoose.Types.ObjectId();
      const threadId = new mongoose.Types.ObjectId();
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Thread, 'paginate').callsFake((query, options, cb) => {
        cb(null, {
          docs: [
            {
              _id: threadId,
              message: { content: 'Deleted profile' },
              read: false,
              userFrom: { _id: viewerId },
              userTo: null,
              toObject() {
                return {
                  _id: threadId,
                  message: { content: 'Deleted profile' },
                  read: false,
                  userFrom: { _id: viewerId },
                  userTo: null,
                };
              },
            },
          ],
          pages: 1,
        });
      });
      typedStub<
        [
          id: import('mongoose').Types.ObjectId,
          field: string,
          callback: LegacyCallback,
        ]
      >(Thread, 'findById').callsFake(() =>
        Promise.reject(new Error('backfill failed')),
      );

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: viewerId }, query: {} }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (
        bodyArray<{ userTo?: object | null }>(res.body)[0].userTo === null ||
        bodyArray<{ userTo?: object | null }>(res.body)[0].userTo === undefined
      ).should.be.true();
    });

    it('keeps deleted profile fields empty when backfill finds no thread', async () => {
      const viewerId = new mongoose.Types.ObjectId();
      const threadId = new mongoose.Types.ObjectId();
      typedStub<
        [
          query: QueryFilter<ThreadRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Thread, 'paginate').callsFake((query, options, cb) => {
        cb(null, {
          docs: [
            {
              _id: threadId,
              message: { content: 'Deleted profile' },
              read: false,
              userFrom: null,
              userTo: { _id: viewerId },
              toObject() {
                return {
                  _id: threadId,
                  message: { content: 'Deleted profile' },
                  read: false,
                  userFrom: null,
                  userTo: { _id: viewerId },
                };
              },
            },
          ],
          pages: 1,
        });
      });
      typedStub<
        [
          id: import('mongoose').Types.ObjectId,
          field: string,
          callback: LegacyCallback,
        ]
      >(Thread, 'findById').callsFake(() => Promise.resolve(null));

      const res = deferredResponse();
      messagesController.inbox({ user: { _id: viewerId }, query: {} }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      (
        bodyArray<{ userFrom?: object | null }>(res.body)[0].userFrom ===
          null ||
        bodyArray<{ userFrom?: object | null }>(res.body)[0].userFrom ===
          undefined
      ).should.be.true();
    });

    it('sends and stores messages without an automatic spam classification', async () => {
      const { sender, receiver } = await prepareSender();
      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'A fictional greeting.',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      bodyField<string>(res.body, 'content').should.equal(
        'A fictional greeting.',
      );
      const saved = required(
        await Message.findOne({ userFrom: sender._id }).sort({ created: -1 }),
      );
      (saved.spam === undefined).should.be.true();
      (saved.read === false).should.be.true();
      (saved.shadowHidden === false).should.be.true();
      required(await Thread.findOne({ message: saved._id }));
    });

    it('returns 400 when first-message profile lookup fails', async () => {
      const { sender, receiver } = await prepareSender();
      typedStub<[id: import('mongoose').Types.ObjectId]>(
        User,
        'findById',
      ).returns({
        exec: () => Promise.reject(new Error('profile lookup failed')),
      });

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
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
    });

    it('returns 400 when send populate fails', async () => {
      typedStub<[callback: LegacyCallback]>(
        Message.prototype,
        'save',
      ).callsFake(function () {
        const fakeMessage = {
          populate: sinon.stub().rejects(new Error('populate failed')),
        };
        return Promise.resolve(fakeMessage);
      });
      const { sender, receiver } = await prepareSender();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
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
    });

    it('returns 400 when message save fails', async () => {
      typedStub<[callback: LegacyCallback]>(
        Message.prototype,
        'save',
      ).callsFake(() => Promise.reject(new Error('save failed')));
      const { sender, receiver } = await prepareSender();

      const res = deferredResponse();
      messagesController.send(
        {
          user: sender,
          body: {
            userTo: receiver._id.toString(),
            content: 'This will not save',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when threadByUser pagination returns no docs', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      typedStub<
        [
          query: QueryFilter<MessageRecord>,
          options: Record<string, unknown>,
          callback: LegacyCallback<PaginationPayload>,
        ]
      >(Message, 'paginate').callsFake((query, options, cb) => {
        cb(null, { docs: null });
      });

      const res = deferredResponse();
      messagesController.threadByUser(
        { user: receiver, query: {} },
        res,
        () => {},
        sender._id.toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('groups incoming sync messages by sender id', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const viewerId = receiver._id;
      const incoming = {
        content: 'Incoming sync message',
        userFrom: sender._id,
        userTo: viewerId,
        created: new Date(),
      };
      typedStub<[query?: QueryFilter<MessageRecord>]>(Message, 'find').returns({
        sort: () => ({
          select: () => ({
            exec: () => Promise.resolve([incoming]),
          }),
        }),
      });

      const res = deferredResponse();
      messagesController.sync({ user: { _id: viewerId }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      const senderKey = sender._id.toString();
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      ).should.have.property(senderKey);
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      )
        [senderKey].should.be.an.Array()
        .with.lengthOf(1);
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      )[senderKey][0].content!.should.containEql('Incoming sync message');
    });

    it('groups outgoing sync messages by recipient id', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const viewerId = sender._id;
      const outgoing = {
        content: 'Outgoing sync message',
        userFrom: viewerId,
        userTo: receiver._id,
        created: new Date(),
      };
      typedStub<[query?: QueryFilter<MessageRecord>]>(Message, 'find').returns({
        sort: () => ({
          select: () => ({
            exec: () => Promise.resolve([outgoing]),
          }),
        }),
      });

      const res = deferredResponse();
      messagesController.sync({ user: { _id: viewerId }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      const receiverKey = receiver._id.toString();
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      ).should.have.property(receiverKey);
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      )
        [receiverKey].should.be.an.Array()
        .with.lengthOf(1);
      bodyField<Record<string, Array<{ content?: string }>>>(
        res.body,
        'messages',
      )[receiverKey][0].content!.should.containEql('Outgoing sync message');
    });

    it('returns 400 when sync user lookup fails', async () => {
      const [sender, receiver] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const viewerId = receiver._id;
      typedStub<[query?: QueryFilter<MessageRecord>]>(Message, 'find').returns({
        sort: () => ({
          select: () => ({
            exec: () =>
              Promise.resolve([
                {
                  content: 'Sync test message',
                  userFrom: sender._id,
                  userTo: viewerId,
                  created: new Date(),
                },
              ]),
          }),
        }),
      });
      typedStub<[query?: QueryFilter<UserRecord>]>(User, 'find').returns({
        select: () => ({
          exec: () => Promise.reject(new Error('user lookup failed')),
        }),
      });

      const res = deferredResponse();
      messagesController.sync({ user: { _id: viewerId }, query: {} }, res);
      await res.waitForResponse();

      res.statusCode.should.equal(400);
    });

    it('returns 400 when sync user lookup fails', async () => {
      typedStub<[query?: QueryFilter<MessageRecord>]>(Message, 'find').returns({
        sort: () => ({
          select: () => ({
            exec: () => Promise.resolve([]),
          }),
        }),
      });
      typedStub<[query?: QueryFilter<UserRecord>]>(User, 'find').returns({
        select: () => ({
          exec: () => Promise.reject(new Error('user lookup failed')),
        }),
      });
      const [user] = await utils.saveUsers(utils.generateUsers(1));

      const res = deferredResponse();
      messagesController.sync({ user: { _id: user._id }, query: {} }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('query scoping and response details', () => {
    const longDescription =
      'I am a long-time member of this community and I love to travel and host people from all over the world. ' +
      'I enjoy cooking, cycling, hiking and sharing stories with travellers passing through my town.';
    const genericError =
      'Snap! Something went wrong. If this keeps happening, please contact us.';
    const winston: typeof import('winston') = require('winston');
    const statService: typeof import('./../../../stats/server/services/stats.server.service.mts') = require('./../../../stats/server/services/stats.server.service.mts');

    function saveMembers(count: number): Promise<UserDocument[]> {
      return utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(count, { public: true }),
      );
    }

    async function prepareSender() {
      const [sender, receiver] = await saveMembers(2);
      const senderDoc = required(await User.findById(sender._id));
      senderDoc.description = longDescription;
      senderDoc.roles = ['user'];
      await senderDoc.save();
      return { sender: senderDoc, receiver };
    }

    async function sendMessage(
      user: object,
      body: Record<string, unknown>,
    ): Promise<DeferredResponse> {
      const res = deferredResponse();
      messagesController.send({ user, body, headers: {} }, res);
      return res.waitForResponse();
    }

    async function seedThread(
      from: UserDocument,
      to: UserDocument,
      content: string,
      read: boolean,
      updated: Date,
    ) {
      const message = await Message.create({
        content,
        userFrom: from._id,
        userTo: to._id,
        read,
      });
      return Thread.create({
        userFrom: from._id,
        userTo: to._id,
        message: message._id,
        read,
        updated,
      });
    }

    describe('inbox', () => {
      async function seedInbox() {
        const [viewer, alice, bob, carol] = await saveMembers(4);
        const now = Date.now();
        const incomingUnread = await seedThread(
          alice,
          viewer,
          'first line\nsecond line',
          false,
          new Date(now - 1000),
        );
        await seedThread(viewer, bob, 'Sent', false, new Date(now - 2000));
        await seedThread(bob, viewer, 'Old', true, new Date(now - 3000));
        await seedThread(alice, carol, 'Unrelated', false, new Date(now - 500));
        return { viewer, alice, incomingUnread };
      }
      type Summary = {
        read: boolean;
        message: { excerpt: string };
        userFrom: { username: string };
      };

      it('lists only the threads the viewer takes part in, newest first', async () => {
        const { viewer, alice } = await seedInbox();
        const res = deferredResponse();
        messagesController.inbox({ user: viewer, query: {} }, res);
        await res.waitForResponse();

        const threads = bodyArray<Summary>(res.body);
        threads
          .map(thread => thread.message.excerpt)
          .should.deepEqual(['first line second line', 'Sent', 'Old']);
        threads
          .map(thread => thread.read)
          .should.deepEqual([false, true, true]);
        threads[0].userFrom.username.should.equal(alice.username);
      });

      it('lists only unread threads addressed to the viewer when asked', async () => {
        const { viewer } = await seedInbox();
        const res = deferredResponse();
        messagesController.inbox(
          { user: viewer, query: { filter: 'unread' } },
          res,
        );
        await res.waitForResponse();

        bodyArray<Summary>(res.body)
          .map(thread => thread.message.excerpt)
          .should.deepEqual(['first line second line']);
      });

      it('honours the requested page and page size', async () => {
        const { viewer } = await seedInbox();
        const res = deferredResponse();
        messagesController.inbox(
          { user: viewer, query: { page: 2, limit: 2 } },
          res,
        );
        await res.waitForResponse();

        bodyArray<Summary>(res.body)
          .map(thread => thread.message.excerpt)
          .should.deepEqual(['Old']);
      });

      it('shortens long excerpts to 100 characters', async () => {
        const [viewer, alice] = await saveMembers(2);
        await seedThread(alice, viewer, 'x'.repeat(150), false, new Date());
        const res = deferredResponse();
        messagesController.inbox({ user: viewer, query: {} }, res);
        await res.waitForResponse();

        bodyArray<Summary>(res.body)[0].message.excerpt.should.equal(
          'x'.repeat(100),
        );
      });

      it('returns an empty list when pagination yields no documents', async () => {
        typedStub<
          [
            query: QueryFilter<ThreadRecord>,
            options: Record<string, unknown>,
            callback: LegacyCallback<PaginationPayload>,
          ]
        >(Thread, 'paginate').callsFake((query, options, cb) => {
          cb(null, { docs: null, pages: 0 });
        });
        const [viewer] = await saveMembers(1);
        const res = deferredResponse();
        messagesController.inbox({ user: viewer, query: {} }, res);
        await res.waitForResponse();

        res.statusCode.should.equal(200);
        res.body.should.deepEqual([]);
      });
    });

    describe('send', () => {
      let notify: import('sinon').SinonStub;
      const throttle = config.limits.messagesToIndividualsThrottle;
      const originalCount = throttle.count;

      beforeEach(() => {
        notify = sinon.stub(messageThrottleAlerts, 'notify').resolves();
      });
      afterEach(() => {
        throttle.count = originalCount;
      });

      it('rejects content that is empty once its markup is stripped', async () => {
        const { sender, receiver } = await prepareSender();
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: '<p> </p>',
        });

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'message').should.equal(
          'Please write a message.',
        );
      });

      it('throttles only above the limit and counts only the sender’s own recipients', async () => {
        throttle.count = 1;
        const { sender, receiver } = await prepareSender();
        const [stranger, other, another] = await saveMembers(3);
        await Message.create([
          { content: 'Mine', userFrom: sender._id, userTo: other._id },
          { content: 'Theirs', userFrom: stranger._id, userTo: receiver._id },
          {
            content: 'Theirs too',
            userFrom: stranger._id,
            userTo: another._id,
          },
        ]);

        const atLimit = await sendMessage(sender, {
          userTo: new mongoose.Types.ObjectId().toString(),
          content: 'Hello there friend',
        });
        atLimit.statusCode.should.equal(404);
        notify.called.should.equal(false);

        await Message.create({
          content: 'Mine again',
          userFrom: sender._id,
          userTo: another._id,
        });
        const overLimit = await sendMessage(sender, {
          userTo: new mongoose.Types.ObjectId().toString(),
          content: 'Hello there friend',
        });
        overLimit.statusCode.should.equal(429);
        notify.calledOnceWithExactly(sender, 2).should.equal(true);
      });

      it('records the throttle hit in the statistics', async () => {
        throttle.count = -1;
        const stat = sinon.stub(statService, 'stat');
        const { sender } = await prepareSender();
        await sendMessage(sender, {
          userTo: new mongoose.Types.ObjectId().toString(),
          content: 'Hello there friend',
        });

        stat.calledOnce.should.equal(true);
        stat.firstCall.args[0].should.deepEqual({
          namespace: 'message-throttle',
          counts: { count: 1 },
          tags: {},
        });
      });

      it('logs a failure to queue the throttle alert', async () => {
        throttle.count = -1;
        const failure = new Error('Notification unavailable');
        notify.rejects(failure);
        const log = sinon.stub(winston.Logger.prototype, 'log');
        const { sender } = await prepareSender();
        await sendMessage(sender, {
          userTo: new mongoose.Types.ObjectId().toString(),
          content: 'Hello there friend',
        });

        const entry = required(
          log
            .getCalls()
            .find(
              call =>
                call.args[1] ===
                'Failed queuing message throttle notification.',
            ),
        );
        entry.args[0].should.equal('error');
        (entry.args[2] as object).should.have.property('error');
      });

      it('tells the sender when the recipient does not exist', async () => {
        const { sender } = await prepareSender();
        const res = await sendMessage(sender, {
          userTo: new mongoose.Types.ObjectId().toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(404);
        bodyField<string>(res.body, 'message').should.equal(
          'Member you are writing to does not exist.',
        );
      });

      it('gives the same answer when the recipient lookup fails', async () => {
        const { sender, receiver } = await prepareSender();
        typedStub<[query?: QueryFilter<UserRecord>]>(User, 'findOne').returns({
          exec: () => Promise.reject(new Error('recipient lookup failed')),
        });
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(404);
        bodyField<string>(res.body, 'message').should.equal(
          'Member you are writing to does not exist.',
        );
      });

      it('asks a sender without a profile description to write one', async () => {
        const [sender, receiver] = await saveMembers(2);
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'error').should.equal('empty-profile');
        bodyField<string>(res.body, 'message').should.equal(
          'Please fill out your profile description before you send messages.',
        );
        bodyField<number>(res.body, 'limit').should.be.above(0);
      });

      it('treats a sender missing from the database as having no profile', async () => {
        const [receiver] = await saveMembers(1);
        const ghost = utils.createTestUser();
        ghost.roles = ['user'];
        const res = await sendMessage(ghost, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'error').should.equal('empty-profile');
      });

      it('only lets a sender without a description reply in a thread they take part in', async () => {
        const [sender, receiver, third, fourth] = await saveMembers(4);
        await seedThread(third, fourth, 'Not ours', false, new Date());
        const unrelated = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });
        unrelated.statusCode.should.equal(400);
        bodyField<string>(unrelated.body, 'error').should.equal(
          'empty-profile',
        );

        await seedThread(receiver, sender, 'Hi first', false, new Date());
        const reply = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });
        reply.statusCode.should.equal(200);
      });

      it('stores the message and its thread as unread for the recipient', async () => {
        const { sender, receiver } = await prepareSender();
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(200);
        const thread = required(
          await Thread.findOne({ userFrom: sender._id, userTo: receiver._id }),
        );
        thread.read!.should.equal(false);
        thread
          .message!.toString()
          .should.equal(bodyField<string>(res.body, '_id').toString());
      });

      it('updates the existing thread of the pair, whichever way round it was started', async () => {
        const { sender, receiver } = await prepareSender();
        const [third, fourth] = await saveMembers(2);
        const unrelated = await seedThread(
          third,
          fourth,
          'Not ours',
          false,
          new Date('2020-01-01'),
        );
        const pair = await seedThread(
          receiver,
          sender,
          'Started by them',
          true,
          new Date('2020-01-02'),
        );
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hello there friend',
        });

        res.statusCode.should.equal(200);
        (await Thread.countDocuments({})).should.equal(2);
        required(await Thread.findById(unrelated._id))
          .message!.toString()
          .should.equal(unrelated.message!.toString());
        const updated = required(await Thread.findById(pair._id));
        updated
          .message!.toString()
          .should.equal(bodyField<string>(res.body, '_id').toString());
        updated.read!.should.equal(false);
      });

      it('creates no thread for a restricted sender', async () => {
        const { sender, receiver } = await prepareSender();
        sender.roles = ['user', 'shadowban'];
        await sender.save();
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'Hidden from recipient',
        });

        res.statusCode.should.equal(200);
        (await Thread.countDocuments({})).should.equal(0);
      });

      it('logs a failure to save the message', async () => {
        typedStub<[callback: LegacyCallback]>(
          Message.prototype,
          'save',
        ).callsFake(() => Promise.reject(new Error('save failed')));
        const log = sinon.stub(winston.Logger.prototype, 'log');
        const { sender, receiver } = await prepareSender();
        const res = await sendMessage(sender, {
          userTo: receiver._id.toString(),
          content: 'This will not save',
        });

        res.statusCode.should.equal(400);
        const entry = required(
          log
            .getCalls()
            .find(call => call.args[1] === 'Message failed to send. #sa239'),
        );
        entry.args[0].should.equal('error');
      });
    });

    describe('markRead', () => {
      for (const messageIds of [
        ['aaaaaaaaaaaaaaaaaaaaaaaaa'],
        ['xaaaaaaaaaaaaaaaaaaaaaaaa'],
        [['aaaaaaaaaaaaaaaaaaaaaaaa']],
      ]) {
        it(`rejects malformed identifiers ${JSON.stringify(messageIds)}`, async () => {
          const res = deferredResponse();
          messagesController.markRead(
            {
              user: { _id: new mongoose.Types.ObjectId() },
              body: { messageIds },
            },
            res,
          );
          await res.waitForResponse();

          res.statusCode.should.equal(400);
          bodyField<string>(res.body, 'message').should.equal(
            'Invalid message identifiers.',
          );
        });
      }

      it('accepts an empty list without touching any message', async () => {
        const update = sinon.spy(Message, 'updateMany');
        const res = deferredResponse();
        messagesController.markRead(
          {
            user: { _id: new mongoose.Types.ObjectId() },
            body: { messageIds: [] },
          },
          res,
        );
        await res.waitForResponse();

        res.statusCode.should.equal(200);
        update.called.should.equal(false);
      });

      it('explains why marking messages read failed', async () => {
        sinon.stub(Message, 'updateMany').rejects(new Error('update failed'));
        const [user] = await saveMembers(1);
        const res = deferredResponse();
        messagesController.markRead(
          {
            user: { id: user._id.toString(), _id: user._id },
            body: { messageIds: [new mongoose.Types.ObjectId().toString()] },
          },
          res,
        );
        await res.waitForResponse();

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'message').should.equal(genericError);
      });
    });

    describe('guards and failures', () => {
      it('answers unauthenticated count and sync requests with the forbidden message', async () => {
        const count = deferredResponse();
        messagesController.messagesCount({}, count);
        const sync = deferredResponse();
        messagesController.sync({}, sync);
        await count.waitForResponse();
        await sync.waitForResponse();

        for (const res of [count, sync]) {
          res.statusCode.should.equal(403);
          bodyField<string>(res.body, 'message').should.equal('Forbidden.');
        }
      });

      it('answers unauthenticated and empty draft previews with their messages', () => {
        const unauthenticated = deferredResponse();
        messagesController.preview({}, unauthenticated);
        unauthenticated.statusCode.should.equal(403);
        bodyField<string>(unauthenticated.body, 'message').should.equal(
          'Forbidden.',
        );

        const empty = deferredResponse();
        messagesController.preview({ user: {}, body: { content: ' ' } }, empty);
        empty.statusCode.should.equal(400);
        bodyField<string>(empty.body, 'message').should.equal(
          'Please write a message.',
        );
      });

      it('explains why counting unread threads failed', async () => {
        sinon.stub(Thread, 'countDocuments').rejects(new Error('count failed'));
        const [user] = await saveMembers(1);
        const res = deferredResponse();
        messagesController.messagesCount({ user }, res);
        await res.waitForResponse();

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'message').should.equal(genericError);
      });

      it('explains why a sync failed', async () => {
        sinon.stub(Message, 'find').returns({
          sort: () => ({
            select: () => ({
              exec: () => Promise.reject(new Error('find failed')),
            }),
          }),
        } as unknown as ReturnType<typeof Message.find>);
        const [user] = await saveMembers(1);
        const res = deferredResponse();
        messagesController.sync({ user, query: {} }, res);
        await res.waitForResponse();

        res.statusCode.should.equal(400);
        bodyField<string>(res.body, 'message').should.equal(genericError);
      });
    });

    describe('threadByUser', () => {
      async function seedConversations() {
        const [viewer, alice, bob] = await saveMembers(3);
        const fromAlice = await seedThread(
          alice,
          viewer,
          'From Alice',
          false,
          new Date(),
        );
        const fromBob = await seedThread(
          bob,
          viewer,
          'From Bob',
          false,
          new Date(),
        );
        return { viewer, alice, bob, fromAlice, fromBob };
      }

      it('leaves messages unread unless asked to mark them read', async () => {
        const { viewer, alice, fromAlice } = await seedConversations();
        const res = deferredResponse();
        let nextCalled = false;
        messagesController.threadByUser(
          { user: viewer, query: {} },
          res,
          () => {
            nextCalled = true;
          },
          alice._id.toString(),
        );
        await new Promise(resolve => setTimeout(resolve, 100));

        nextCalled.should.equal(true);
        required(await Thread.findById(fromAlice._id)).read!.should.equal(
          false,
        );
        (await Message.countDocuments({ read: true })).should.equal(0);
      });

      it('marks only the opened conversation read', async () => {
        const { viewer, alice, fromAlice, fromBob } = await seedConversations();
        await new Promise<void>(resolve => {
          messagesController.threadByUser(
            { user: viewer, query: {} },
            deferredResponse(),
            () => resolve(),
            alice._id.toString(),
            true,
          );
        });

        required(await Thread.findById(fromAlice._id)).read!.should.equal(true);
        required(await Thread.findById(fromBob._id)).read!.should.equal(false);
        (await Message.countDocuments({ read: true })).should.equal(1);
      });

      it('does not write anything when the viewer received nothing', async () => {
        const { viewer, alice } = await seedConversations();
        const messageUpdate = sinon.spy(Message, 'updateMany');
        const threadUpdate = sinon.spy(Thread, 'updateMany');
        await new Promise<void>(resolve => {
          messagesController.threadByUser(
            { user: alice, query: {} },
            deferredResponse(),
            () => resolve(),
            viewer._id.toString(),
            true,
          );
        });

        messageUpdate.called.should.equal(false);
        threadUpdate.called.should.equal(false);
      });

      it('stops when pagination reports an error', async () => {
        const { viewer, alice } = await seedConversations();
        typedStub<
          [
            query: QueryFilter<MessageRecord>,
            options: Record<string, unknown>,
            callback: LegacyCallback<PaginationPayload>,
          ]
        >(Message, 'paginate').callsFake((query, options, cb) => {
          cb(new Error('paginate failed'), { docs: [], pages: 1 });
        });
        const res = deferredResponse();
        let nextCalled = false;
        messagesController.threadByUser(
          { user: viewer, query: {} },
          res,
          () => {
            nextCalled = true;
          },
          alice._id.toString(),
        );
        await res.waitForResponse();

        res.statusCode.should.equal(400);
        nextCalled.should.equal(false);
      });

      it('sets no pagination link for an empty page', async () => {
        const { viewer, alice } = await seedConversations();
        typedStub<
          [
            query: QueryFilter<MessageRecord>,
            options: Record<string, unknown>,
            callback: LegacyCallback<PaginationPayload>,
          ]
        >(Message, 'paginate').callsFake((query, options, cb) => {
          cb(null, { docs: [], pages: 2 });
        });
        const res = deferredResponse();
        res.locals = { paginate: { href: ({ page }) => `/x?page=${page}` } };
        let linked = false;
        res.links = () => {
          linked = true;
          return res;
        };
        await new Promise<void>(resolve => {
          messagesController.threadByUser(
            { user: viewer, query: { page: 1, limit: 1 } },
            res,
            () => resolve(),
            alice._id.toString(),
          );
        });

        linked.should.equal(false);
      });
    });

    describe('sync', () => {
      type SyncBody = {
        messages: Record<string, Array<{ content: string }>>;
        users: Array<{ _id: string }>;
      };
      async function seedSync() {
        const [viewer, alice, bob, carol] = await saveMembers(4);
        const at = (iso: string) => new Date(iso);
        await Message.create([
          {
            content: 'January',
            userFrom: alice._id,
            userTo: viewer._id,
            created: at('2020-01-01'),
          },
          {
            content: 'February',
            userFrom: viewer._id,
            userTo: alice._id,
            created: at('2020-02-01'),
          },
          {
            content: 'March',
            userFrom: alice._id,
            userTo: viewer._id,
            created: at('2020-03-01'),
          },
          {
            content: 'Hidden',
            userFrom: alice._id,
            userTo: viewer._id,
            shadowHidden: true,
            created: at('2020-02-15'),
          },
          {
            content: 'Unrelated',
            userFrom: bob._id,
            userTo: carol._id,
            created: at('2020-02-10'),
          },
        ]);
        return { viewer, alice };
      }
      async function runSync(
        user: UserDocument,
        query: Record<string, unknown>,
      ) {
        const res = deferredResponse();
        messagesController.sync({ user, query }, res);
        await res.waitForResponse();
        const body = res.body as SyncBody;
        return {
          res,
          contents: Object.values(body.messages)
            .flat()
            .map(message => message.content)
            .sort(),
          users: body.users.map(user => String(user._id)).sort(),
        };
      }

      it('returns only visible messages of the viewer and only the members involved', async () => {
        const { viewer, alice } = await seedSync();
        const { contents, users } = await runSync(viewer, {});

        contents.should.deepEqual(['February', 'January', 'March']);
        users.should.deepEqual([String(viewer._id), String(alice._id)].sort());
      });

      it('limits messages to the requested date range', async () => {
        const { viewer } = await seedSync();

        (
          await runSync(viewer, {
            dateFrom: '2020-01-15',
            dateTo: '2020-02-20',
          })
        ).contents.should.deepEqual(['February']);
        (
          await runSync(viewer, { dateFrom: '2020-01-15' })
        ).contents.should.deepEqual(['February', 'March']);
        (
          await runSync(viewer, { dateTo: '2020-02-20' })
        ).contents.should.deepEqual(['February', 'January']);
      });

      it('accepts a start date in the future when no end date is given', async () => {
        const { viewer } = await seedSync();
        const { res, contents } = await runSync(viewer, {
          dateFrom: '2999-01-01',
        });

        res.statusCode.should.equal(200);
        contents.should.deepEqual([]);
      });
    });
  });
});
