const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.gravatar.server.controller.mts') = require('../../server/controllers/admin.gravatar.server.controller.mts');

type Captured = { statusCode: number; body: Record<string, unknown> };

function response() {
  const captured: Captured = { statusCode: 200, body: {} };
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
  return { res, captured };
}

async function list(page?: unknown) {
  const { res, captured } = response();
  await controller.list(page === undefined ? {} : { query: { page } }, res);
  return captured;
}

describe('Admin Gravatar controller pages', () => {
  const User = mongoose.model('User');
  afterEach(async () => {
    await utils.clearDatabase();
  });

  it('rejects page strings that are not plain digits with a message', async () => {
    for (const page of ['+2', ' 2', '2 ', '2e0', '1x']) {
      const result = await list(page);
      assert.equal(result.statusCode, 400, `page ${JSON.stringify(page)}`);
      assert.deepEqual(result.body, { message: 'Invalid page.' });
    }
  });

  it('accepts multi-digit pages and the largest supported page', async () => {
    const ten = await list('10');
    assert.equal(ten.statusCode, 200);
    assert.equal(ten.body.page, 10);
    const largest = Math.floor(Number.MAX_SAFE_INTEGER / 50);
    const last = await list(String(largest));
    assert.equal(last.statusCode, 200);
    assert.equal(last.body.page, largest);
    const beyond = await list(String(largest + 1));
    assert.equal(beyond.statusCode, 400);
  });

  it('reports no next page when the count fills the page exactly', async () => {
    await User.collection.insertMany(
      Array.from({ length: 50 }, (_, index) => ({
        username: `fictional-exact-${index}`,
        email: `fictional-exact-${index}@example.test`,
        avatarSource: 'gravatar',
      })),
    );
    const result = await list();
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.accounts, 50);
    assert.equal(result.body.hasNextPage, false);
  });
});
