const mongoose: typeof import('mongoose') = require('mongoose');
require('../../server/models/request-limit.server.model.mjs');
const requestLimitService = require('../../server/services/targeted-request-limits.server.service.mjs');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { createHmac }: typeof import('node:crypto') = require('node:crypto');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
require('should');

const RequestLimit = mongoose.model<{
  count: number;
  key: string;
  expiresAt: Date;
}>('RequestLimit');

describe('Targeted request limit storage', function () {
  before(async function () {
    await RequestLimit.ensureIndexes();
  });

  afterEach(async function () {
    await RequestLimit.deleteMany({});
  });

  it('atomically counts concurrent requests despite simultaneous first upserts', async function () {
    // All increments must use one window, even across a real minute boundary.
    const now = Date.now() + 60_000;
    const dimensions = [
      { name: 'ip-and-identity', value: '198.51.100.9:sample', limit: 100 },
    ];
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        requestLimitService.consume({
          operation: 'concurrency-test',
          dimensions,
          windowMs: 60_000,
          now,
        }),
      ),
    );

    results.every(result => result.allowed).should.be.true();
    const records = await RequestLimit.find({});
    records.length.should.equal(1);
    records[0].count.should.equal(40);
    records[0].key.should.not.containEql('198.51.100.9');
    records[0].key.should.not.containEql('sample');
  });

  it('starts a fresh counter in the next bounded window', async function () {
    const dimensions = [{ name: 'ip', value: '198.51.100.10', limit: 1 }];
    const first = await requestLimitService.consume({
      operation: 'window-test',
      dimensions,
      windowMs: 1000,
      now: 1200,
    });
    const limited = await requestLimitService.consume({
      operation: 'window-test',
      dimensions,
      windowMs: 1000,
      now: 1300,
    });
    const nextWindow = await requestLimitService.consume({
      operation: 'window-test',
      dimensions,
      windowMs: 1000,
      now: 2000,
    });

    first.allowed.should.be.true();
    limited.allowed.should.be.false();
    limited.retryAfterSeconds.should.equal(1);
    nextWindow.allowed.should.be.true();
    const records = await RequestLimit.find({});
    records.length.should.equal(2);
    records.map(record => record.expiresAt.getTime()).should.containEql(2000);
  });

  it('propagates database errors so middleware can fail closed', async function () {
    const original = RequestLimit.findOneAndUpdate;
    // The test replaces Mongoose's thenable query with the rejected promise the service awaits.
    RequestLimit.findOneAndUpdate = (() =>
      Promise.reject(
        new Error('database offline'),
      )) as unknown as typeof RequestLimit.findOneAndUpdate;
    try {
      await requestLimitService
        .consume({
          operation: 'storage-error-test',
          dimensions: [{ name: 'ip', value: '198.51.100.11', limit: 1 }],
          windowMs: 1000,
        })
        .should.be.rejectedWith('database offline');
    } finally {
      RequestLimit.findOneAndUpdate = original;
    }
  });

  it('retries a duplicate-key race from the initial upsert', async function () {
    const original = RequestLimit.findOneAndUpdate;
    let calls = 0;
    RequestLimit.findOneAndUpdate = (() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ code: 11000 });
      }
      return Promise.resolve({ count: 1 });
    }) as unknown as typeof RequestLimit.findOneAndUpdate;

    try {
      const result = await requestLimitService.consume({
        operation: 'duplicate-upsert-test',
        dimensions: [{ name: 'ip', value: '198.51.100.14', limit: 1 }],
        windowMs: 1000,
      });
      result.allowed.should.be.true();
      calls.should.equal(2);
    } finally {
      RequestLimit.findOneAndUpdate = original;
    }
  });

  it('exposes consume and digest to CommonJS callers', async function () {
    // Load a fresh copy: the interop object is built when the module loads.
    const commonjs: typeof import('../../server/services/targeted-request-limits.server.service.mts').default =
      require('./../../../../testutils/server/mock-module')(
        require.resolve('../../server/services/targeted-request-limits.server.service.mts'),
        {},
      );
    assert.equal(
      commonjs.digest('198.51.100.25'),
      requestLimitService.digest('198.51.100.25'),
    );
    assert.deepEqual(
      await commonjs.consume({
        operation: 'commonjs-test',
        dimensions: [{ name: 'ip', value: '198.51.100.25', limit: 1 }],
        windowMs: 60_000,
        now: 60_000,
      }),
      { allowed: true, retryAfterSeconds: 60 },
    );
  });

  it('digests values as hex HMACs keyed by the session secret', function () {
    assert.equal(
      requestLimitService.digest('198.51.100.20'),
      createHmac('sha256', config.sessionSecret)
        .update('198.51.100.20')
        .digest('hex'),
    );
  });

  it('asks clients to retry when the current window ends', async function () {
    const dimensions = [{ name: 'ip', value: '198.51.100.21', limit: 1 }];
    const first = await requestLimitService.consume({
      operation: 'retry-after-test',
      dimensions,
      windowMs: 60_000,
      now: 120_500,
    });
    assert.deepEqual(first, { allowed: true, retryAfterSeconds: 60 });
  });

  it('throws other errors from the initial upsert without retrying', async function () {
    const original = RequestLimit.findOneAndUpdate;
    let calls = 0;
    RequestLimit.findOneAndUpdate = (() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(
            Object.assign(new Error('write conflict'), { code: 112 }),
          )
        : Promise.resolve({ count: 1 });
    }) as unknown as typeof RequestLimit.findOneAndUpdate;
    try {
      await requestLimitService
        .consume({
          operation: 'other-error-test',
          dimensions: [{ name: 'ip', value: '198.51.100.22', limit: 1 }],
          windowMs: 1000,
        })
        .should.be.rejectedWith('write conflict');
      calls.should.equal(1);
    } finally {
      RequestLimit.findOneAndUpdate = original;
    }
  });

  it('counts the request on the existing record after a duplicate-key race', async function () {
    const options = { windowMs: 60_000, now: 60_000 };
    const other = [{ name: 'ip', value: '198.51.100.23', limit: 5 }];
    const raced = [{ name: 'ip', value: '198.51.100.24', limit: 1 }];
    for (let request = 0; request < 3; request++)
      await requestLimitService.consume({
        operation: 'other-race-test',
        dimensions: other,
        ...options,
      });
    await requestLimitService.consume({
      operation: 'race-test',
      dimensions: raced,
      ...options,
    });

    const original = RequestLimit.findOneAndUpdate;
    let duplicateRaised = false;
    RequestLimit.findOneAndUpdate = function (
      this: typeof RequestLimit,
      ...args: Parameters<typeof original>
    ) {
      if (!duplicateRaised) {
        duplicateRaised = true;
        return Promise.reject({ code: 11000 });
      }
      return original.apply(this, args);
    } as unknown as typeof RequestLimit.findOneAndUpdate;
    let result;
    try {
      result = await requestLimitService.consume({
        operation: 'race-test',
        dimensions: raced,
        ...options,
      });
    } finally {
      RequestLimit.findOneAndUpdate = original;
    }

    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 60 });
    const counts = (await RequestLimit.find({}).sort({ count: 1 }).lean()).map(
      record => record.count,
    );
    assert.deepEqual(counts, [2, 3]);
  });
});
