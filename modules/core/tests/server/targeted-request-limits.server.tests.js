const mongoose = require('mongoose');
require('../../server/models/request-limit.server.model.mjs');
const requestLimitService = require('../../server/services/targeted-request-limits.server.service.mjs');
require('should');

const RequestLimit = mongoose.model('RequestLimit');

describe('Targeted request limit storage', function () {
  before(async function () {
    await RequestLimit.ensureIndexes();
  });

  afterEach(async function () {
    await RequestLimit.deleteMany({});
  });

  it('atomically counts concurrent requests despite simultaneous first upserts', async function () {
    const dimensions = [
      { name: 'ip-and-identity', value: '198.51.100.9:sample', limit: 100 },
    ];
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        requestLimitService.consume({
          operation: 'concurrency-test',
          dimensions,
          windowMs: 60_000,
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
    RequestLimit.findOneAndUpdate = () =>
      Promise.reject(new Error('database offline'));
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
    RequestLimit.findOneAndUpdate = () => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject({ code: 11000 });
      }
      return Promise.resolve({ count: 1 });
    };

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
});
