const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

type MessagesController =
  typeof import('../../server/controllers/admin.messages.server.controller.mts');
type MessagesSanitizerModule = Pick<
  typeof import('../../../messages/server/controllers/messages.server.controller.mjs'),
  'sanitizeMessages'
>;
const adminMessages: Pick<
  MessagesController,
  'getMessages' | 'getScammerRecipients' | 'sendScammerWarning'
> = require('./../../server/controllers/admin.messages.server.controller.mts');
const messagesSanitizer: MessagesSanitizerModule = require('../../../messages/server/controllers/messages.server.controller.mjs');
const should: typeof import('should') = require('should');

type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type ReferenceThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadRecord;
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type PromiseQuery<T> = { exec(): Promise<T> };
type ChainablePromiseQuery<T> = {
  sort(): ChainablePromiseQuery<T>;
  populate(): ChainablePromiseQuery<T>;
  exec(): Promise<T>;
};
type RecipientQuery = {
  select(fields: string): {
    sort(): PromiseQuery<
      Array<{ _id: import('mongoose').Types.ObjectId; username: string }>
    >;
  };
};
type ResponseBody = Record<string, unknown>;
type MockResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};

const Message = mongoose.model<MessageRecord>('Message');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const User = mongoose.model<UserRecord>('User');

function messageQuery<T>(execute: () => Promise<T>): ChainablePromiseQuery<T> {
  const query: ChainablePromiseQuery<T> = {
    sort() {
      return query;
    },
    populate() {
      return query;
    },
    exec: execute,
  };
  return query;
}

function messageFindQuery(
  execute: () => Promise<unknown[] | null>,
): ReturnType<typeof Message.find> {
  // The controller's tests exercise only this query-chain surface.
  return messageQuery(execute) as unknown as ReturnType<typeof Message.find>;
}

function referenceThreadFindQuery(
  execute: () => Promise<unknown[] | null>,
): ReturnType<typeof ReferenceThread.find> {
  // The controller's tests exercise only this query-chain surface.
  return messageQuery(execute) as unknown as ReturnType<
    typeof ReferenceThread.find
  >;
}

function promiseQuery<T>(execute: () => Promise<T>): PromiseQuery<T> {
  return { exec: execute };
}

function mockResponse(): MockResponse {
  let resolveResponse: (response: MockResponse) => void = () => {
    throw new Error('Response completion has not been initialised');
  };
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
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
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

function responseBody(response: MockResponse): ResponseBody {
  if (typeof response.body !== 'object' || response.body === null) {
    throw new Error('Expected a JSON response body');
  }
  return Object.fromEntries(Object.entries(response.body));
}

describe('Admin messages controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('rejects invalid user ids', async () => {
    for (const user1 of ['bad-id', {}]) {
      const res = mockResponse();
      adminMessages.getMessages(
        {
          body: {
            user1,
            user2: new mongoose.Types.ObjectId().toString(),
          },
        },
        res,
      );
      const response = await res.waitForResponse();
      response.statusCode.should.equal(400);
      should(responseBody(response).message).equal('Cannot interpret id.');
    }
  });

  it('accepts ObjectId-like query ids supported by Mongoose', async () => {
    sinon.stub(Message, 'find').returns(messageFindQuery(async () => []));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(referenceThreadFindQuery(async () => []));
    const id = new mongoose.Types.ObjectId();
    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: { id: id.id, toHexString: () => id.toHexString() },
        },
      },
      res,
    );
    (await res.waitForResponse()).statusCode.should.equal(200);
  });

  it('returns 400 when message lookup fails', async () => {
    sinon.stub(Message, 'find').returns(
      messageFindQuery(async () => {
        throw new Error('lookup failed');
      }),
    );

    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: new mongoose.Types.ObjectId().toString(),
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
  });

  it('returns 400 when reference thread lookup fails', async () => {
    sinon.stub(Message, 'find').returns(messageFindQuery(async () => []));
    sinon.stub(ReferenceThread, 'find').returns(
      referenceThreadFindQuery(async () => {
        throw new Error('reference lookup failed');
      }),
    );

    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: new mongoose.Types.ObjectId().toString(),
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
  });

  it('uses an empty reference thread list when the lookup returns null', async () => {
    sinon.stub(Message, 'find').returns(messageFindQuery(async () => []));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(referenceThreadFindQuery(async () => null));

    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: new mongoose.Types.ObjectId().toString(),
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    should(responseBody(response).referenceThreads).deepEqual([]);
  });

  it('passes a null message lookup result to the legacy sanitizer', async () => {
    const sanitizer = sinon
      .stub(messagesSanitizer, 'sanitizeMessages')
      .returns([]);
    sinon.stub(Message, 'find').returns(messageFindQuery(async () => null));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(referenceThreadFindQuery(async () => []));

    const res = mockResponse();
    adminMessages.getMessages({ body: {} }, res);

    await res.waitForResponse();
    should(sanitizer.calledOnce).equal(true);
    should(sanitizer.firstCall.args[0]).equal(null);
  });

  it('looks up recipients when no current administrator id is available', async () => {
    const scammerId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();
    sinon
      .stub(User, 'findOne')
      .returns(
        promiseQuery(() =>
          Promise.resolve({ _id: scammerId, username: 'scammer' }),
        ) as unknown as ReturnType<typeof User.findOne>,
      );
    sinon
      .stub(Message, 'distinct')
      .returns(
        promiseQuery(() =>
          Promise.resolve([recipientId]),
        ) as unknown as ReturnType<typeof Message.distinct>,
      );
    const recipientQuery: RecipientQuery = {
      select: () => ({
        sort: () => ({
          exec: () =>
            Promise.resolve([{ _id: recipientId, username: 'recipient' }]),
        }),
      }),
    };
    const findUsers = sinon
      .stub(User, 'find')
      .returns(
        recipientQuery as unknown as ReturnType<typeof User.find>,
      ) as import('sinon').SinonStub<
      [filter?: import('mongoose').QueryFilter<UserRecord>],
      ReturnType<typeof User.find>
    >;

    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' } },
      res,
    );
    const response = await res.waitForResponse();

    const recipients = responseBody(response).recipients;
    if (!Array.isArray(recipients))
      throw new Error('Expected recipient results');
    recipients.length.should.equal(1);
    should(findUsers.firstCall.args[0]).deepEqual({
      _id: { $in: [recipientId] },
    });
  });

  it('returns a generic lookup error when recipient discovery fails', async () => {
    sinon
      .stub(User, 'findOne')
      .returns(
        promiseQuery(() =>
          Promise.reject(new Error('lookup failed')),
        ) as unknown as ReturnType<typeof User.findOne>,
      );

    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' }, user: { _id: 'admin-id' } },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
  });

  it('preserves a coded lookup error that has no message', async () => {
    sinon
      .stub(User, 'findOne')
      .returns(
        promiseQuery(() =>
          Promise.reject({ statusCode: 422 }),
        ) as unknown as ReturnType<typeof User.findOne>,
      );
    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' }, user: { _id: 'admin-id' } },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(422);
    should(Object.hasOwn(responseBody(response), 'message')).equal(true);
  });

  it('preserves non-string messages from coded lookup errors', async () => {
    const message = { legacy: 'payload' };
    sinon
      .stub(User, 'findOne')
      .returns(
        promiseQuery(() =>
          Promise.reject({ statusCode: 422, message }),
        ) as unknown as ReturnType<typeof User.findOne>,
      );
    const res = mockResponse();
    await adminMessages.getScammerRecipients(
      { body: { username: 'scammer' }, user: { _id: 'admin-id' } },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(422);
    should(responseBody(response).message).equal(message);
  });

  // A link without an address is dropped, leaving only a blank line.
  for (const content of [undefined, '<a>x</a><br>'])
    it(`rejects warning content without text: ${content}`, async () => {
      const res = mockResponse();
      await adminMessages.sendScammerWarning(
        { body: { username: 'scammer', content } },
        res,
      );
      const response = await res.waitForResponse();

      response.statusCode.should.equal(400);
      should(responseBody(response).message).equal('Please write a message.');
    });

  it('returns the validation error when warning recipient lookup is invalid', async () => {
    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      { body: { content: 'Safety warning' } },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    should(responseBody(response).message).equal('Missing `username` field.');
  });

  it('returns a generic warning error when recipient discovery fails', async () => {
    sinon
      .stub(User, 'findOne')
      .returns(
        promiseQuery(() =>
          Promise.reject(new Error('lookup failed')),
        ) as unknown as ReturnType<typeof User.findOne>,
      );

    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      {
        body: { content: 'Safety warning', username: 'scammer' },
        user: { _id: 'admin-id' },
      },
      res,
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
  });
});

describe('Admin scammer warnings with stored members', () => {
  const crypto: typeof import('node:crypto') = require('node:crypto');
  const assert: typeof import('node:assert').strict =
    require('node:assert').strict;
  const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
  type ThreadRecord =
    import('../../../../testutils/server/model-contracts.mts').ThreadRecord;
  const Thread = mongoose.model<ThreadRecord>('Thread');
  type Saved = { _id: import('mongoose').Types.ObjectId; username: string };
  let admin: Saved;
  let scammer: Saved;
  let first: Saved;
  let second: Saved;
  let bystanders: Saved[];
  const requestId = 'a'.repeat(32);

  beforeEach(async () => {
    const raw = utils.generateUsersWithSharedPassword(6);
    raw[0].username = 'warnadmin';
    raw[1].username = 'warnscammer';
    // Created in reverse name order, so only sorting lists them by name.
    raw[2].username = 'warnrecipientb';
    raw[3].username = 'warnrecipienta';
    raw[4].username = 'warnbystandera';
    raw[5].username = 'warnbystanderb';
    const saved = (await utils.saveUsersWithCachedPasswords(
      raw,
    )) as unknown as Saved[];
    [admin, scammer, second, first, ...bystanders] = saved;
    await Message.create(
      [second, first, admin].map(recipient => ({
        content: 'Fictional scam.',
        userFrom: scammer._id,
        userTo: recipient._id,
      })),
    );
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  async function call(
    action: 'getScammerRecipients' | 'sendScammerWarning',
    body: Record<string, unknown>,
  ) {
    const res = mockResponse();
    await adminMessages[action]({ body, user: { _id: admin._id } }, res);
    const response = await res.waitForResponse();
    return {
      statusCode: response.statusCode,
      body: JSON.parse(JSON.stringify(response.body)),
    };
  }
  function warn(body: Record<string, unknown> = {}) {
    return call('sendScammerWarning', {
      username: scammer.username,
      content: 'Please ignore that fictional message.',
      requestId,
      ...body,
    });
  }
  function threadId(a: Saved, b: Saved) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify([String(a._id), String(b._id)].sort()))
      .digest('hex')
      .slice(0, 24);
  }

  it('lists recipients by name with only their public names', async () => {
    const response = await call('getScammerRecipients', {
      username: `  ${scammer.username}  `,
    });
    assert.equal(response.statusCode, 200);
    const users = await User.find({ _id: { $in: [first._id, second._id] } })
      .sort({ username: 1 })
      .lean();
    assert.deepEqual(response.body, {
      scammer: { _id: String(scammer._id), username: scammer.username },
      recipients: users.map(user => ({
        _id: String(user._id),
        username: user.username,
        displayName: user.displayName,
      })),
    });
  });

  it('requires a well-formed request ID', async () => {
    for (const bad of [[requestId], 'x' + requestId, requestId + 'x']) {
      assert.deepEqual(await warn({ requestId: bad }), {
        statusCode: 400,
        body: { message: 'A valid warning request ID is required.' },
      });
    }
    assert.equal(await Message.countDocuments({ userFrom: admin._id }), 0);
  });

  it('warns every other recipient once, visibly, in a thread of its own', async () => {
    const unrelated = await Thread.create({
      userFrom: bystanders[0]._id,
      userTo: bystanders[1]._id,
      updated: new Date('2020-01-01T00:00:00.000Z'),
      read: true,
    });
    const response = await warn();
    assert.deepEqual(response, {
      statusCode: 200,
      body: {
        scammer: { _id: String(scammer._id), username: scammer.username },
        sent: 2,
      },
    });
    const warnings = await Message.find({ userFrom: admin._id }).lean();
    assert.deepEqual(
      warnings.map(warning => String(warning.userTo)).sort(),
      [String(first._id), String(second._id)].sort(),
    );
    for (const warning of warnings) {
      assert.equal(warning.shadowHidden, false);
      assert.equal(warning.read, false);
      assert.equal(warning.notificationCount, 0);
      assert.ok(warning.created instanceof Date);
      const thread = (await Thread.findOne({ message: warning._id }).lean())!;
      assert.equal(String(thread.userFrom), String(admin._id));
      assert.equal(String(thread.userTo), String(warning.userTo));
      assert.equal(thread.updated?.getTime(), warning.created?.getTime());
    }
    assert.deepEqual(
      await Thread.findById(unrelated._id).lean(),
      unrelated.toObject(),
    );
    assert.equal(await Thread.countDocuments(), 3);
  });

  it('writes the other threads when one cannot be created', async () => {
    // A thread between other members already holds the first recipient's key.
    await Thread.create({
      _id: new mongoose.Types.ObjectId(threadId(admin, first)),
      userFrom: bystanders[0]._id,
      userTo: bystanders[1]._id,
      updated: new Date(),
    });
    const bulkWrite = Thread.bulkWrite.bind(Thread);
    const write = sinon.stub(Thread, 'bulkWrite');
    // Another request wins the first attempt, so the batch is retried.
    write
      .onFirstCall()
      .rejects(Object.assign(new Error('Concurrent insert'), { code: 11000 }));
    write.onSecondCall().callsFake(bulkWrite as never);
    assert.equal((await warn()).statusCode, 400);
    sinon.restore();
    const secondWarning = (await Message.findOne({
      userFrom: admin._id,
      userTo: second._id,
    }).lean())!;
    assert.ok(await Thread.exists({ message: secondWarning._id }));

    // Without a concurrent insert, the first attempt also writes the rest.
    await Thread.deleteMany({ message: secondWarning._id });
    assert.equal((await warn()).statusCode, 400);
    assert.ok(await Thread.exists({ message: secondWarning._id }));
  });

  it('retries only after a duplicate key error', async () => {
    const callable = Object.assign(() => undefined, { code: 11000 });
    for (const failure of [
      new Error('Thread storage unavailable'),
      Object.assign(new Error('Validation failed'), { code: 121 }),
      callable,
    ]) {
      const bulkWrite = Thread.bulkWrite.bind(Thread);
      const write = sinon.stub(Thread, 'bulkWrite');
      write.onFirstCall().callsFake(() => Promise.reject(failure) as never);
      write.onSecondCall().callsFake(bulkWrite as never);
      assert.equal((await warn()).statusCode, 400);
      assert.equal(write.callCount, 1);
      sinon.restore();
    }
  });
});
