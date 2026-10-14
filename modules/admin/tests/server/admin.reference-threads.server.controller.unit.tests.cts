const mongoose: typeof import('mongoose') = require('mongoose');
const sinon = require('sinon');

type ReferenceThreadsController =
  typeof import('../../server/controllers/admin.reference-threads.server.controller.mts');
const adminReferenceThreads: Pick<
  ReferenceThreadsController,
  'list'
> = require('./../../server/controllers/admin.reference-threads.server.controller.mts');
const should: typeof import('should') = require('should');

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
});
