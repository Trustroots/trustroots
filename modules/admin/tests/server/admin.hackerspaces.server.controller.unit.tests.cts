const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;

type Controller =
  typeof import('../../server/controllers/admin.hackerspaces.server.controller.mts');

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
  };
  return res;
}

describe('Admin hackerspaces controller', () => {
  let controller: Controller;
  const originalFetch = global.fetch;
  before(async () => {
    controller =
      await import('../../server/controllers/admin.hackerspaces.server.controller.mts');
  });
  afterEach(() => {
    global.fetch = originalFetch;
    sinon.restore();
  });

  it('falls back to the default message when the Collector fails with a non-object', async () => {
    global.fetch = (() =>
      Promise.reject('fictional failure')) as unknown as typeof global.fetch;
    const res = response();
    await controller.preview({}, res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, {
      message: 'Could not fetch the SpaceAPI Collector.',
    });
  });

  it('rejects keys that are not exactly 64 hex characters, and arrays of keys, with a message', async () => {
    const model = sinon.stub(mongoose, 'model');
    const key = 'a'.repeat(64);
    for (const publicKey of [`z${key}`, `${key}z`, [key]]) {
      const res = response();
      await controller.signerIdentity({ query: { publicKey } }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(publicKey));
      assert.deepEqual(res.body, {
        message: 'A valid Nostr public key is required.',
      });
    }
    assert.equal(model.called, false);
  });
});
