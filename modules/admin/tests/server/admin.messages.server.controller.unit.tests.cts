const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

type MessagesController =
  typeof import('../../server/controllers/admin.messages.server.controller.mjs');
const adminMessages: Pick<
  MessagesController,
  'getMessages' | 'getScammerRecipients' | 'sendScammerWarning'
> = require('./../../server/controllers/admin.messages.server.controller.mjs');
const should: typeof import('should') = require('should');

type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type ReferenceThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadRecord;
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type CallbackQuery<T> = {
  sort(): CallbackQuery<T>;
  populate(): CallbackQuery<T>;
  exec(callback: (error: Error | null, result: T | null) => void): void;
};
type PromiseQuery<T> = { exec(): Promise<T> };
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

function messageQuery<T>(
  execute: (callback: (error: Error | null, result: T | null) => void) => void,
): CallbackQuery<T> {
  const query: CallbackQuery<T> = {
    sort() {
      return query;
    },
    populate() {
      return query;
    },
    exec(callback) {
      execute(callback);
    },
  };
  return {
    ...query,
    populate() {
      return query;
    },
  };
}

function messageFindQuery(
  execute: (
    callback: (error: Error | null, result: unknown[] | null) => void,
  ) => void,
): ReturnType<typeof Message.find> {
  // The controller's tests exercise only this query-chain surface.
  return messageQuery(execute) as unknown as ReturnType<typeof Message.find>;
}

function referenceThreadFindQuery(
  execute: (
    callback: (error: Error | null, result: unknown[] | null) => void,
  ) => void,
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
    const res = mockResponse();
    adminMessages.getMessages(
      {
        body: {
          user1: 'bad-id',
          user2: new mongoose.Types.ObjectId().toString(),
        },
      },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
    should(responseBody(response).message).equal('Cannot interpret id.');
  });

  it('returns 400 when message lookup fails', async () => {
    sinon
      .stub(Message, 'find')
      .returns(messageFindQuery(cb => cb(new Error('lookup failed'), null)));

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
    sinon.stub(Message, 'find').returns(messageFindQuery(cb => cb(null, [])));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(
        referenceThreadFindQuery(cb =>
          cb(new Error('reference lookup failed'), null),
        ),
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
    sinon.stub(Message, 'find').returns(messageFindQuery(cb => cb(null, [])));
    sinon
      .stub(ReferenceThread, 'find')
      .returns(referenceThreadFindQuery(cb => cb(null, null)));

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
      .returns(recipientQuery as unknown as ReturnType<typeof User.find>);

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

  it('rejects missing warning content', async () => {
    const res = mockResponse();
    await adminMessages.sendScammerWarning(
      { body: { username: 'scammer' } },
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
