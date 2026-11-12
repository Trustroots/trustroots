const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.gravatar.server.controller.mts') = require('../../server/controllers/admin.gravatar.server.controller.mts');

async function list(query?: Parameters<typeof controller.list>[0]['query']) {
  const captured = { statusCode: 200, body: {} as Record<string, unknown> };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    send(body: unknown) {
      captured.body = body as Record<string, unknown>;
      return body;
    },
  };
  await controller.list(query ? { query } : {}, res);
  return captured;
}

describe('Admin Gravatar controller pages', () => {
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  it('accepts only plain-digit pages up to the largest supported one', async () => {
    const largest = Math.floor(Number.MAX_SAFE_INTEGER / 50);
    for (const page of ['+2', ' 2', '2 ', '2e0', '1x', String(largest + 1)]) {
      const { statusCode, body } = await list({ page });
      assert.deepEqual([statusCode, body], [400, { message: 'Invalid page.' }]);
    }
    for (const page of [10, largest]) {
      const { statusCode, body } = await list({ page: String(page) });
      assert.deepEqual([statusCode, body.page], [200, page]);
    }
  });

  it('rejects invalid sort values with the sort error', async () => {
    for (const query of [{ sort: 'emailHash' }, { direction: 'other' }]) {
      const { statusCode, body } = await list(query);
      assert.deepEqual([statusCode, body], [400, { message: 'Invalid sort.' }]);
    }
  });

  it('uses name collation only for text sorts and keeps undated members last', async () => {
    const aggregate = sinon.stub(mongoose.model('User'), 'aggregate').returns({
      exec: async () => [{ total: [], members: [] }],
    } as never);
    const collation = { collation: { locale: 'en', strength: 2 } };

    for (const [query, stages, options] of [
      [undefined, [{ $sort: { _id: 1 } }], undefined],
      [{ sort: 'username' }, [{ $sort: { username: 1, _id: 1 } }], collation],
      [
        { sort: 'displayName', direction: 'descending' },
        [{ $sort: { displayName: -1, _id: 1 } }],
        collation,
      ],
      [
        { sort: 'seen', direction: 'descending' },
        [
          { $set: { seenMissing: { $ne: [{ $type: '$seen' }, 'date'] } } },
          { $sort: { seenMissing: 1, seen: -1, _id: 1 } },
        ],
        undefined,
      ],
    ] as const) {
      const { statusCode } = await list(query);
      assert.equal(statusCode, 200);
      const [pipeline, queryOptions]: [
        import('mongoose').PipelineStage[],
        unknown?,
      ] = aggregate.lastCall.args;
      const { $facet } = pipeline[2] as { $facet: { members: unknown[] } };
      assert.deepEqual(pipeline[0], { $match: { avatarSource: 'gravatar' } });
      assert.deepEqual($facet.members, [
        ...stages,
        { $skip: 0 },
        { $limit: 50 },
        { $unset: 'seenMissing' },
      ]);
      assert.deepEqual(queryOptions, options);
    }
  });

  it('reports no next page when the count fills the page exactly', async () => {
    await mongoose.model('User').collection.insertMany(
      Array.from({ length: 50 }, (_, index) => ({
        username: `fictional-exact-${index}`,
        email: `fictional-exact-${index}@example.test`,
        avatarSource: 'gravatar',
      })),
    );
    const { statusCode, body } = await list();
    assert.deepEqual(
      [statusCode, body.accounts, body.hasNextPage],
      [200, 50, false],
    );
  });
});
