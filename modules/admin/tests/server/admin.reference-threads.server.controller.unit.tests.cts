const mongoose: typeof import('mongoose') = require('mongoose');
const sinon = require('sinon');

type ReferenceThreadsController =
  typeof import('../../server/controllers/admin.reference-threads.server.controller.mts');
const adminReferenceThreads: Pick<
  ReferenceThreadsController,
  'list'
> = require('./../../server/controllers/admin.reference-threads.server.controller.mts');
const should: typeof import('should') = require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

type ReferenceThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadRecord;
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type RecipientCount = {
  _id: import('mongoose').Types.ObjectId | null;
  count: number;
};
type MockResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  send(body: unknown): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};
type ResultQuery<T> = {
  sort(...args: unknown[]): ResultQuery<T>;
  limit(...args: unknown[]): ResultQuery<T>;
  populate(...args: unknown[]): ResultQuery<T>;
  exec(): Promise<T>;
};
type UserResultQuery<T> = {
  select(...args: unknown[]): UserResultQuery<T>;
  exec(): Promise<T>;
};
type AggregateQuery<T> = { exec(): Promise<T> };
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const User = mongoose.model<UserRecord>('User');

function objectBody(response: MockResponse): Record<string, unknown> {
  if (typeof response.body !== 'object' || response.body === null) {
    throw new Error('Expected an object response body');
  }
  return Object.fromEntries(Object.entries(response.body));
}

function referenceQuery(
  result: ReferenceThreadRecord[] | null,
  error?: Error,
): ResultQuery<ReferenceThreadRecord[] | null> {
  const query: ResultQuery<ReferenceThreadRecord[] | null> = {
    sort: () => query,
    limit: () => query,
    populate: () => query,
    exec: () => (error ? Promise.reject(error) : Promise.resolve(result)),
  };
  return query;
}

function aggregateQuery(
  result: RecipientCount[] | null,
): AggregateQuery<RecipientCount[] | null> {
  return { exec: () => Promise.resolve(result) };
}

function usersQuery(
  result: Array<{
    _id: import('mongoose').Types.ObjectId;
    displayName: string;
  }>,
): UserResultQuery<typeof result> {
  const query: UserResultQuery<typeof result> = {
    select: () => query,
    exec: () => Promise.resolve(result),
  };
  return query;
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
    waitForResponse: () => promise,
  };
  return res;
}

describe('Admin reference threads controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('sends an empty result when the query resolves null', async () => {
    sinon
      .stub(ReferenceThread, 'find')
      .returns(
        referenceQuery(null) as unknown as ReturnType<
          typeof ReferenceThread.find
        >,
      );
    sinon
      .stub(ReferenceThread, 'aggregate')
      .returns(
        aggregateQuery(null) as unknown as ReturnType<
          typeof ReferenceThread.aggregate
        >,
      );

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    should(objectBody(response)).deepEqual({
      items: [],
      topNegativeRecipients: [],
    });
  });

  it('returns top negative recipients', async () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    const clock = sinon.useFakeTimers(now);
    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId, displayName: 'Negative Receiver' };
    sinon
      .stub(ReferenceThread, 'find')
      .returns(
        referenceQuery([]) as unknown as ReturnType<
          typeof ReferenceThread.find
        >,
      );
    const aggregate = sinon
      .stub(ReferenceThread, 'aggregate')
      .returns(
        aggregateQuery([{ _id: userId, count: 3 }]) as unknown as ReturnType<
          typeof ReferenceThread.aggregate
        >,
      );
    sinon
      .stub(User, 'find')
      .returns(usersQuery([user]) as unknown as ReturnType<typeof User.find>);

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    should(objectBody(response).topNegativeRecipients).deepEqual([
      {
        count: 3,
        user,
      },
    ]);
    should(aggregate.firstCall.args[0][0]).deepEqual({
      $match: {
        created: { $gte: new Date('2025-07-27T12:00:00.000Z') },
        reference: 'no',
      },
    });
    clock.restore();
  });

  it('keeps recipient ids when their profiles are unavailable', async () => {
    const missingUserId = new mongoose.Types.ObjectId();
    sinon
      .stub(ReferenceThread, 'find')
      .returns(
        referenceQuery([]) as unknown as ReturnType<
          typeof ReferenceThread.find
        >,
      );
    sinon.stub(ReferenceThread, 'aggregate').returns(
      aggregateQuery([
        { _id: null, count: 1 },
        { _id: missingUserId, count: 2 },
      ]) as unknown as ReturnType<typeof ReferenceThread.aggregate>,
    );
    sinon
      .stub(User, 'find')
      .returns(usersQuery([]) as unknown as ReturnType<typeof User.find>);

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();
    should(objectBody(response).topNegativeRecipients).deepEqual([
      { count: 1, user: null },
      { count: 2, user: missingUserId },
    ]);
  });

  it('returns an error response when loading reference threads fails', async () => {
    sinon
      .stub(ReferenceThread, 'find')
      .returns(
        referenceQuery([], new Error('lookup failed')) as unknown as ReturnType<
          typeof ReferenceThread.find
        >,
      );
    sinon
      .stub(ReferenceThread, 'aggregate')
      .returns(
        aggregateQuery([]) as unknown as ReturnType<
          typeof ReferenceThread.aggregate
        >,
      );

    const res = mockResponse();
    adminReferenceThreads.list({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    should(objectBody(response).message).startWith(
      'Snap! Something went wrong.',
    );
  });

  describe('with stored references', () => {
    afterEach(utils.clearDatabase);

    it('lists negative references newest first with minimal user profiles', async () => {
      const fixtureId = new mongoose.Types.ObjectId().toHexString();
      const users = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(3).map((user, index) => ({
          ...user,
          email: `reference-${fixtureId}-${index}@example.test`,
        })),
      );
      const [a, b, c] = users.map(user => user._id);
      const reference = (
        userFrom: typeof a,
        userTo: typeof a,
        value: 'yes' | 'no',
        created: string,
      ) => ({
        thread: new mongoose.Types.ObjectId(),
        userFrom,
        userTo,
        reference: value,
        created: new Date(created),
      });
      await ReferenceThread.insertMany([
        reference(a, b, 'no', '2026-10-01T00:00:00Z'),
        reference(c, b, 'no', '2026-10-03T00:00:00Z'),
        reference(a, c, 'yes', '2026-10-04T00:00:00Z'),
        reference(b, c, 'no', '2026-10-02T00:00:00Z'),
      ]);
      // The { reference, created } index would return newest first unsorted.
      await ReferenceThread.init();
      await ReferenceThread.collection.dropIndex('reference_1_created_-1');

      const res = mockResponse();
      adminReferenceThreads.list({}, res);
      const response = await res
        .waitForResponse()
        .finally(() => ReferenceThread.createIndexes());
      response.statusCode.should.equal(200);
      const body = JSON.parse(JSON.stringify(response.body));

      body.items
        .map((item: { created: string; reference: string }) => [
          item.created,
          item.reference,
        ])
        .should.deepEqual([
          ['2026-10-03T00:00:00.000Z', 'no'],
          ['2026-10-02T00:00:00.000Z', 'no'],
          ['2026-10-01T00:00:00.000Z', 'no'],
        ]);
      const profile = (user: (typeof users)[number]) => ({
        _id: user._id.toString(),
        displayName: user.displayName,
        username: user.username,
      });
      should(body.items[0].userFrom).deepEqual(profile(users[2]));
      should(body.items[0].userTo).deepEqual(profile(users[1]));

      should(body.topNegativeRecipients).deepEqual([
        { count: 2, user: profile(users[1]) },
        { count: 1, user: profile(users[2]) },
      ]);
    });

    it('skips recipient groups without a user id', async () => {
      const recipient = new mongoose.Types.ObjectId();
      const negative = (userTo?: typeof recipient) => ({
        thread: new mongoose.Types.ObjectId(),
        userFrom: new mongoose.Types.ObjectId(),
        ...(userTo ? { userTo } : {}),
        reference: 'no',
        created: new Date(),
      });
      await ReferenceThread.collection.insertMany([
        negative(),
        negative(recipient),
        negative(recipient),
      ]);

      const res = mockResponse();
      adminReferenceThreads.list({}, res);
      const response = await res.waitForResponse();

      response.statusCode.should.equal(200);
      should(objectBody(response).topNegativeRecipients).deepEqual([
        { count: 2, user: recipient },
        { count: 1, user: null },
      ]);
    });
  });
});
