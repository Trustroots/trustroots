const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
require('should');

function loadStatsService() {
  const influxService = {
    stat: sinon.stub().callsArg(1),
  };
  const statsService = proxyquire(
    '../../server/services/stats.server.service',
    {
      './influx.server.service.js': influxService,
    },
  );

  return { influxService, statsService };
}

describe('Stats service unit tests', () => {
  it('records a count stat', done => {
    const { influxService, statsService } = loadStatsService();

    statsService.count('unitCount', done);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitCount',
      counts: {
        count: 1,
      },
    });
  });

  it('records a count stat with an explicit count and time', done => {
    const { influxService, statsService } = loadStatsService();
    const time = new Date('2026-06-06T10:00:00.000Z');

    statsService.count('unitCount', 3, time, done);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitCount',
      counts: {
        count: 3,
      },
      time,
    });
  });

  it('records a count stat when the callback is the third argument', done => {
    const { influxService, statsService } = loadStatsService();

    statsService.count('unitCount', 4, done);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitCount',
      counts: {
        count: 4,
      },
    });
  });

  it('records a count stat when no callback is provided', () => {
    const { influxService, statsService } = loadStatsService();

    statsService.count('unitCount');

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitCount',
      counts: {
        count: 1,
      },
    });
  });

  it('records a value stat', done => {
    const { influxService, statsService } = loadStatsService();

    statsService.value('unitValue', 12, done);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitValue',
      values: {
        value: 12,
      },
    });
  });

  it('records a value stat with time', done => {
    const { influxService, statsService } = loadStatsService();
    const time = new Date('2026-06-06T10:00:00.000Z');

    statsService.value('unitValue', 12, time, done);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitValue',
      values: {
        value: 12,
      },
      time,
    });
  });

  it('records a value stat when no callback is provided', () => {
    const { influxService, statsService } = loadStatsService();

    statsService.value('unitValue', 12);

    influxService.stat.firstCall.args[0].should.deepEqual({
      namespace: 'unitValue',
      values: {
        value: 12,
      },
    });
  });

  it('records a complex stat object', done => {
    const { influxService, statsService } = loadStatsService();
    const stat = {
      namespace: 'messages',
      counts: { sent: 1 },
      values: { length: 180 },
      tags: { type: 'firstMessage' },
      meta: { threadId: 'thread-1' },
      time: new Date('2026-06-06T10:00:00.000Z'),
    };

    statsService.stat(stat, done);

    influxService.stat.firstCall.args[0].should.deepEqual(stat);
  });

  it('rejects an invalid stat object', done => {
    const { influxService, statsService } = loadStatsService();

    statsService.stat({ values: { count: 1 } }, err => {
      err.should.be.Error();
      influxService.stat.called.should.be.false();
      done();
    });
  });

  it('rejects stat objects with no counts or values', done => {
    const { statsService } = loadStatsService();

    statsService.stat({ namespace: 'empty' }, err => {
      err.message.should.equal('The stat should contain counts or values');
      done();
    });
  });

  it('rejects stat objects with empty counts and values', function () {
    const { statsService } = loadStatsService();

    (() => {
      statsService._validateStat({
        namespace: 'empty',
        counts: {},
        values: {},
      });
    }).should.throw('The stat should contain counts or values');
  });

  it('rejects duplicate keys across counts, values, meta and tags', function () {
    const { statsService } = loadStatsService();

    (() => {
      statsService._validateStat({
        namespace: 'duplicate',
        counts: { same: 1 },
        values: { same: 2 },
      });
    }).should.throw(
      'Every key of stat counts, values, meta and tags must be unique',
    );
  });

  it('rejects non-number count and value fields', function () {
    const { statsService } = loadStatsService();

    (() => {
      statsService._validateStat({
        namespace: 'invalidValue',
        counts: { count: '1' },
      });
    }).should.throw('Each of counts and values should be a number');

    (() => {
      statsService._validateStat({
        namespace: 'invalidValue',
        values: { value: '1' },
      });
    }).should.throw('Each of counts and values should be a number');
  });

  it('rejects non-Date time fields', function () {
    const { statsService } = loadStatsService();

    (() => {
      statsService._validateStat({
        namespace: 'invalidTime',
        counts: { count: 1 },
        time: '2026-06-06',
      });
    }).should.throw('Time must be a Date object or not provided');
  });

  it('accepts valid count and value fields with unique keys', function () {
    const { statsService } = loadStatsService();

    (() => {
      statsService._validateStat({
        namespace: 'valid',
        counts: { count: 1 },
        values: { value: 2 },
        meta: { source: 'unit' },
        tags: { tag: 'test' },
      });
    }).should.not.throw();
  });

  it('passes influx errors through to the callback', done => {
    const influxError = new Error('influx failed');
    const influxService = {
      stat: sinon.stub().callsArgWith(1, influxError),
    };
    const statsService = proxyquire(
      '../../server/services/stats.server.service',
      {
        './influx.server.service.js': influxService,
      },
    );

    statsService.count('unitCount', err => {
      err.should.equal(influxError);
      done();
    });
  });
});
