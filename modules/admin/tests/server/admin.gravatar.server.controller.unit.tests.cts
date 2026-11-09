const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.gravatar.server.controller.mts') = require('../../server/controllers/admin.gravatar.server.controller.mts');

async function list(page?: unknown) {
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
  await controller.list(page === undefined ? {} : { query: { page } }, res);
  return captured;
}

describe('Admin Gravatar controller pages', () => {
  afterEach(async () => {
    await utils.clearDatabase();
  });

  it('accepts only plain-digit pages up to the largest supported one', async () => {
    const largest = Math.floor(Number.MAX_SAFE_INTEGER / 50);
    for (const page of ['+2', ' 2', '2 ', '2e0', '1x', String(largest + 1)]) {
      const { statusCode, body } = await list(page);
      assert.deepEqual([statusCode, body], [400, { message: 'Invalid page.' }]);
    }
    for (const page of [10, largest]) {
      const { statusCode, body } = await list(String(page));
      assert.deepEqual([statusCode, body.page], [200, page]);
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
