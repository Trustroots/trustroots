const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const controller: typeof import('../../server/controllers/admin.username-changes.server.controller.mts') = require('../../server/controllers/admin.username-changes.server.controller.mts');
const User = mongoose.model('User');

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Admin username changes controller', () => {
  afterEach(() => sinon.restore());

  const invalid = { message: 'Invalid username change filters.' };
  const largest = Math.floor(Number.MAX_SAFE_INTEGER / 50);
  async function list(page: unknown) {
    const res = mockResponse();
    await controller.list({ query: { page, range: 'all' } }, res);
    return res;
  }

  it('accepts positive safe pages given as numbers or plain digits', async () => {
    for (const [page, expected] of [
      [2, 2],
      ['3', 3],
      ['10', 10],
      [largest, largest],
    ]) {
      const res = await list(page);
      assert.deepStrictEqual(
        [res.statusCode, (res.body as { page: number }).page],
        [200, expected],
      );
    }
  });

  it('rejects every other page value', async () => {
    for (const page of [
      ...[null, 'not-a-page', '0', '9007199254740992', 0, 1.5, largest + 1],
      ...[['2'], '1e3', ' 2', '2 '],
    ]) {
      const res = await list(page);
      assert.deepStrictEqual([res.statusCode, res.body], [400, invalid]);
    }
  });

  it('returns an error response when the aggregation fails', async () => {
    sinon.stub(User, 'aggregate').returns({
      exec: sinon.stub().rejects(new Error('aggregate failed')),
    } as unknown as ReturnType<typeof User.aggregate>);
    const res = mockResponse();
    await controller.list({ query: {} }, res);
    assert.deepStrictEqual(
      [res.statusCode, res.body],
      [
        400,
        {
          message:
            'Snap! Something went wrong. If this keeps happening, please contact us.',
        },
      ],
    );
  });
});

describe('Admin username changes controller with stored members', () => {
  const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
  const day = 24 * 60 * 60 * 1000;
  afterEach(utils.clearDatabase);

  async function list(query?: { page?: unknown; range?: unknown }) {
    const res = mockResponse();
    await controller.list(query === undefined ? {} : { query }, res);
    assert.strictEqual(res.statusCode, 200);
    return res.body as {
      changes: Array<Record<string, unknown>>;
      page: number;
      hasNextPage: boolean;
      range: string;
    };
  }

  it('lists recent history and legacy timestamps as complete rows', async () => {
    const now = Date.now();
    const users = mongoose.connection.collection('users');
    const recent = new Date(now - 1000);
    const old = new Date(now - 100 * day);
    const legacyDate = new Date(now - 2000);
    const { insertedId: withHistory } = await users.insertOne({
      username: 'current-name',
      email: 'current-name@example.test',
      displayName: 'Current Name',
      usernameHistory: [
        {
          oldUsername: 'previous',
          newUsername: 'current-name',
          changedAt: recent,
        },
        { oldUsername: 'ancient', newUsername: 'previous', changedAt: old },
      ],
    });
    // Legacy documents may lack the history field altogether.
    const { insertedId: legacy } = await users.insertOne({
      username: 'legacy-name',
      email: 'legacy-name@example.test',
      displayName: 'Legacy Name',
      usernameUpdated: legacyDate,
    });
    // A null history is neither missing nor empty, so the pre-filter skips it.
    await users.insertOne({
      username: 'null-history',
      email: 'null-history@example.test',
      usernameHistory: null,
      usernameUpdated: recent,
    });
    // Neither a recent history entry nor a fallback without history.
    await users.insertOne({
      username: 'old-only',
      email: 'old-only@example.test',
      usernameHistory: [
        { oldUsername: 'older', newUsername: 'old-only', changedAt: old },
      ],
      usernameUpdated: recent,
    });

    const body = await list();
    assert.deepStrictEqual(
      { ...body, changes: undefined },
      { changes: undefined, page: 1, hasNextPage: false, range: '90d' },
    );
    assert.deepStrictEqual(body.changes, [
      {
        _id: withHistory,
        currentUsername: 'current-name',
        displayName: 'Current Name',
        oldUsername: 'previous',
        newUsername: 'current-name',
        changedAt: recent,
        legacy: false,
      },
      {
        _id: legacy,
        currentUsername: 'legacy-name',
        displayName: 'Legacy Name',
        oldUsername: null,
        newUsername: 'legacy-name',
        changedAt: legacyDate,
        legacy: true,
      },
    ]);
  });

  it('reports no next page when exactly one page of changes exists', async () => {
    const now = Date.now();
    await mongoose.connection.collection('users').insertOne({
      username: 'renamed',
      email: 'renamed@example.test',
      usernameHistory: Array.from({ length: 50 }, (_, index) => ({
        oldUsername: `old-${index}`,
        newUsername: 'renamed',
        changedAt: new Date(now - 1000 - index),
      })),
    });
    const body = await list({ range: 'all' });
    assert.strictEqual(body.changes.length, 50);
    assert.strictEqual(body.hasNextPage, false);
  });
});
