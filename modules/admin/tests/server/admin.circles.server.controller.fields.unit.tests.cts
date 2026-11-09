const mongoose: typeof import('mongoose') = require('mongoose');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
// Load the controller on first use, inside the test, so the test covers (and
// can kill) mutants in its module-level field list.
const controller = new Proxy(
  {} as typeof import('../../server/controllers/admin.circles.server.controller.mts').default,
  {
    get: (_target, key) =>
      require('../../server/controllers/admin.circles.server.controller.mts')[
        key
      ],
  },
);

function response() {
  const captured: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = JSON.parse(JSON.stringify(body));
      return body;
    },
    send(body: unknown) {
      return res.json(body);
    },
  };
  return { res, captured };
}

describe('Admin circles controller fields', () => {
  const Tribe = mongoose.model('Tribe');
  afterEach(async () => {
    await utils.clearDatabase();
  });

  it('returns only the administered fields, not slug or label history', async () => {
    const stored = await new Tribe({
      label: 'Example walkers',
      labelHistory: ['Former walkers'],
      slugHistory: ['former-walkers'],
      synonyms: ['ramblers'],
    }).save();
    const check = (body: unknown) => {
      const keys = Object.keys(body as Record<string, unknown>);
      assert(keys.includes('label') && keys.includes('slug'), String(keys));
      for (const hidden of ['labelHistory', 'slugHistory', 'synonyms', '__v'])
        assert(!keys.includes(hidden), `${hidden} in ${keys}`);
    };
    const listed = response();
    await controller.list({}, listed.res);
    const [circle] = listed.captured.body as Record<string, unknown>[];
    check(circle);
    const single = response();
    await controller.get(
      { params: { circle: String(stored._id) } },
      single.res,
    );
    check(single.captured.body);
  });
});
