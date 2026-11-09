// test whether the daily statistics job reaches influxdb via Stats api

const should: typeof import('should') = require('should');
const influx: typeof import('influx') = require('influx');
const sinon = require('sinon');
const winston: typeof import('winston') = require('winston');

const config: typeof import('../../../../../config/config.mts').default = require('./../../../../../config/config.mts');
require('./../../../../offers/server/models/offer.server.model.mjs');
require('./../../../../users/server/models/user.server.model.mjs');
type StatObject =
  import('../../../../stats/server/services/stats.server.service.mts').StatObject;
type StatService = {
  deliver(statObject: StatObject, callback: (error?: unknown) => void): void;
};
const statsService: StatService = require('./../../../../stats/server/services/stats.server.service.mts');
type JobCallback = (error?: Error | null) => void;
const statsJob: (
  job: unknown,
  callback: JobCallback,
) => void = require('./../../../server/jobs/daily-statistics.server.job.mjs');
type StatisticsController = {
  getUsersCount(callback: (error: Error | null, count?: number) => void): void;
  getHostOffersCount(
    callback: (error: Error | null, counts?: number[]) => void,
  ): void;
  getMeetOffersCount(
    callback: (error: Error | null, counts?: number[]) => void,
  ): void;
  getUserLanguagesCount(
    limit: number,
    callback: (
      error: Error | null,
      counts?: Array<{ _id: string; count: number }>,
    ) => void,
  ): void;
  getLastSeenStatistic(
    since: unknown,
    callback: (error: Error | null, result?: unknown) => void,
  ): void;
  getExternalSiteCount(
    site: string,
    callback: (error: Error | null, count?: number) => void,
  ): void;
};
let writeMeasurementStub: import('sinon').SinonStub<
  Parameters<typeof influx.InfluxDB.prototype.writeMeasurement>,
  ReturnType<typeof influx.InfluxDB.prototype.writeMeasurement>
>;

describe('Daily Statistics Job - Unit Test', function () {
  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  // stub the influx endpoint
  beforeEach(function () {
    // stub the influx endpoint(s)
    writeMeasurementStub = sinon.stub(
      influx.InfluxDB.prototype,
      'writeMeasurement',
    );

    // and writeMeasurement returns a Promise
    writeMeasurementStub.callsFake(
      () => new Promise<void>(resolve => process.nextTick(resolve)),
    );

    // provide config options for influxdb
    sinon.stub(config.influxdb, 'options').value({
      host: 'localhost',
      port: 8086,
      protocol: 'http',
      database: 'trustroots-test',
    });
  });

  context('influxdb configured', function () {
    const statistics: Pick<
      StatisticsController,
      | 'getUsersCount'
      | 'getHostOffersCount'
      | 'getMeetOffersCount'
      | 'getUserLanguagesCount'
      | 'getLastSeenStatistic'
      | 'getExternalSiteCount'
    > = require('./../../../server/controllers/statistics.server.controller.mjs');

    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('continues when fetching the user count fails', function (done) {
      sinon
        .stub(statistics, 'getUsersCount')
        .callsFake((cb: Parameters<StatisticsController['getUsersCount']>[0]) =>
          cb(new Error('db down')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching host offer counts fails', function (done) {
      sinon
        .stub(statistics, 'getHostOffersCount')
        .callsFake(
          (cb: Parameters<StatisticsController['getHostOffersCount']>[0]) =>
            cb(new Error('offers db down')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching meet offer count fails', function (done) {
      sinon
        .stub(statistics, 'getMeetOffersCount')
        .callsFake(
          (cb: Parameters<StatisticsController['getMeetOffersCount']>[0]) =>
            cb(new Error('meet db down')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching spoken language counts fails', function (done) {
      sinon
        .stub(statistics, 'getUserLanguagesCount')
        .callsFake(
          (
            limit: number,
            cb: Parameters<StatisticsController['getUserLanguagesCount']>[1],
          ) => cb(new Error('languages db down')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('writes language statistics when spoken language counts are available', function (done) {
      sinon
        .stub(statistics, 'getUserLanguagesCount')
        .callsFake(
          (
            limit: number,
            cb: Parameters<StatisticsController['getUserLanguagesCount']>[1],
          ) =>
            cb(null, [
              { _id: 'en', count: 3 },
              { _id: 'fi', count: 1 },
            ]),
        );
      sinon
        .stub(statistics, 'getUsersCount')
        .callsFake((cb: Parameters<StatisticsController['getUsersCount']>[0]) =>
          cb(null, 4),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when collecting last-seen statistics fails', function (done) {
      sinon
        .stub(statistics, 'getLastSeenStatistic')
        .callsFake(
          (
            since: unknown,
            cb: Parameters<StatisticsController['getLastSeenStatistic']>[1],
          ) => cb(new Error('last seen db down')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('logs and completes when a network count fails', function (done) {
      const original = statistics.getExternalSiteCount;
      statistics.getExternalSiteCount = function (
        site: string,
        cb: Parameters<StatisticsController['getExternalSiteCount']>[1],
      ) {
        if (site === 'facebook') {
          return cb(new Error('network db down'));
        }
        return original.call(statistics, site, cb);
      };

      statsJob(null, function (e) {
        statistics.getExternalSiteCount = original;
        if (e) return done(e);
        done();
      });
    });

    it('continues when writing to influx fails with a general error', function (done) {
      sinon
        .stub(statsService, 'deliver')
        .callsFake((statObject: StatObject, cb: (error?: unknown) => void) =>
          cb(new Error('influx unavailable')),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when writing to influx fails with an influx-specific error', function (done) {
      sinon
        .stub(statsService, 'deliver')
        .callsFake((statObject: StatObject, cb: (error?: unknown) => void) =>
          cb({
            message: 'Writing to Influx service failed.',
            errors: { influx: new Error('influx write failed') },
          }),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when an influx-specific error lacks nested details', function (done) {
      sinon
        .stub(statsService, 'deliver')
        .callsFake((statObject: StatObject, cb: (error?: unknown) => void) =>
          cb({
            message: 'Writing to Influx service failed.',
          }),
        );

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('should reach the influxdb with data in correct format', function (done) {
      statsJob(null, function (e) {
        if (e) return done(e);

        try {
          // test influx endpoint

          // Called once per each remaining daily stat write
          sinon.assert.callCount(writeMeasurementStub, 16);

          // Member count stat point
          const memberMeasurement = writeMeasurementStub.getCall(0).args[0];
          const memberPoints = writeMeasurementStub.getCall(0).args[1];
          const memberPoint = memberPoints[0];
          should(memberPoints.length).eql(1);
          should(memberMeasurement).eql('members');
          should(memberPoint).have.propertyByPath('fields', 'count').eql(0);
          should(memberPoint)
            .have.propertyByPath('tags', 'members')
            .eql('members');
          should(memberPoint).not.have.property('timestamp');

          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
  context('with stubbed collaborators', function () {
    type Delivered = {
      namespace: string;
      values: Record<string, number>;
      tags: Record<string, string>;
    };
    const statistics: Record<
      string,
      unknown
    > = require('./../../../server/controllers/statistics.server.controller.mjs');
    let delivered: Delivered[];
    let logStub: import('sinon').SinonStub;
    let lastSeenSince: unknown[];

    function coded(code: string): Error {
      return Object.assign(new Error('boom'), { code });
    }

    let statisticStubs: Record<string, import('sinon').SinonStub>;

    function stubStatistic(name: string, fake: (...args: never[]) => void) {
      if (!statisticStubs[name]) {
        statisticStubs[name] = sinon.stub(statistics, name);
      }
      statisticStubs[name].callsFake(fake);
    }

    function runJob(): Promise<unknown[]> {
      return new Promise(resolve => {
        statsJob(null, (...args: unknown[]) => resolve(args));
      });
    }

    function stubDeliver(
      fail?: (statObject: Delivered) => unknown,
    ): import('sinon').SinonStub {
      return sinon
        .stub(statsService, 'deliver')
        .callsFake((statObject: StatObject, cb: (error?: unknown) => void) => {
          delivered.push(statObject as unknown as Delivered);
          cb(fail ? fail(statObject as unknown as Delivered) : undefined);
        });
    }

    function logged(): unknown[][] {
      return logStub.getCalls().map(call => call.args);
    }

    function namespaces(): string[] {
      return delivered.map(stat => stat.namespace);
    }

    beforeEach(function () {
      delivered = [];
      lastSeenSince = [];
      statisticStubs = {};
      logStub = sinon.stub(winston, 'log');
      stubStatistic('getUsersCount', (cb: (e: null, n: number) => void) =>
        cb(null, 200),
      );
      stubStatistic(
        'getLastSeenStatistic',
        (since: unknown, cb: (e: null, n: number) => void) => {
          lastSeenSince.push(since);
          cb(null, 50);
        },
      );
      stubStatistic(
        'getHostOffersCount',
        (cb: (e: null, c: Record<string, number>) => void) =>
          cb(null, { yes: 10, maybe: 20, no: 30 }),
      );
      stubStatistic('getMeetOffersCount', (cb: (e: null, n: number) => void) =>
        cb(null, 5),
      );
      stubStatistic(
        'getExternalSiteCount',
        (site: string, cb: (e: null, n: number) => void) => cb(null, 40),
      );
      stubStatistic(
        'getUserLanguagesCount',
        (limit: number, cb: (e: null, c: unknown[]) => void) =>
          cb(null, [
            { _id: 'en', count: 100 },
            { _id: 'fi', count: 20 },
          ]),
      );
    });

    it('writes every statistic with its namespace, values and tags', async function () {
      stubDeliver();

      const args = await runJob();

      should(args).eql([]);
      should(logged()).eql([]);
      should(delivered).eql([
        {
          namespace: 'members',
          values: { count: 200 },
          tags: { members: 'members' },
        },
        ...[
          'memberLastSeenPast7days',
          'memberLastSeenPast14days',
          'memberLastSeenPast30days',
          'memberLastSeenPast6months',
          'memberLastSeenPast12months',
        ].map(namespace => ({
          namespace,
          values: { count: 50, percentage: 25 },
          tags: { access: 'members' },
        })),
        ...[
          ['yes', 10, 5],
          ['maybe', 20, 10],
          ['no', 30, 15],
        ].map(([status, count, percentage]) => ({
          namespace: 'offers',
          values: { count, percentage },
          tags: { type: 'host', status },
        })),
        { namespace: 'offers', values: { count: 5 }, tags: { type: 'meet' } },
        ...[
          'couchsurfing',
          'warmshowers',
          'bewelcome',
          'facebook',
          'twitter',
          'github',
        ].map(network => ({
          namespace: 'membersInNetworks',
          values: { count: 40, percentage: 20 },
          tags: { network },
        })),
        {
          namespace: 'language',
          values: { count: 100, percentage: 50 },
          tags: { language: 'en' },
        },
        {
          namespace: 'language',
          values: { count: 20, percentage: 10 },
          tags: { language: 'fi' },
        },
      ]);
      should(lastSeenSince).eql([
        { days: 7 },
        { days: 14 },
        { days: 30 },
        { months: 6 },
        { months: 12 },
      ]);
    });

    it('asks for the top 40 languages and each network by name', async function () {
      stubDeliver();
      const limits: number[] = [];
      const sites: string[] = [];
      stubStatistic(
        'getUserLanguagesCount',
        (limit: number, cb: (e: null, c: unknown[]) => void) => {
          limits.push(limit);
          cb(null, []);
        },
      );
      stubStatistic(
        'getExternalSiteCount',
        (site: string, cb: (e: null, n: number) => void) => {
          sites.push(site);
          cb(null, 1);
        },
      );

      await runJob();

      should(limits).eql([40]);
      should(sites).eql([
        'couchsurfing',
        'warmshowers',
        'bewelcome',
        'facebook',
        'twitter',
        'github',
      ]);
    });

    it('skips the member count write and logs when the user count fails', async function () {
      stubDeliver();
      stubStatistic('getUsersCount', (cb: (e: Error) => void) =>
        cb(coded('E_COUNT')),
      );

      const args = await runJob();

      should(args).eql([]);
      should(namespaces()).not.containEql('members');
      should(namespaces()).containEql('offers');
      should(logged()).have.length(1);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal(
        'Daily statistics: failed fetching user count.',
      );
      should(logged()[0][2]).have.property('code', 'E_COUNT');
    });

    it('skips host offer writes and logs when host offer counts fail', async function () {
      stubDeliver();
      stubStatistic('getHostOffersCount', (cb: (e: Error) => void) =>
        cb(coded('E_HOST')),
      );

      await runJob();

      should(delivered.filter(stat => stat.tags.type === 'host')).eql([]);
      should(namespaces()).containEql('language');
      should(logged()).have.length(1);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal(
        'Daily statistics: failed fetching hosting offer counts.',
      );
      should(logged()[0][2]).have.property('code', 'E_HOST');
    });

    it('skips the meet offer write and logs when the meet count fails', async function () {
      stubDeliver();
      stubStatistic('getMeetOffersCount', (cb: (e: Error) => void) =>
        cb(coded('E_MEET')),
      );

      await runJob();

      should(delivered.filter(stat => stat.tags.type === 'meet')).eql([]);
      should(namespaces()).containEql('membersInNetworks');
      should(logged()).have.length(1);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal(
        'Daily statistics: failed fetching meet count.',
      );
      should(logged()[0][2]).have.property('code', 'E_MEET');
    });

    it('writes a meet count of zero', async function () {
      stubDeliver();
      stubStatistic('getMeetOffersCount', (cb: (e: null, n: number) => void) =>
        cb(null, 0),
      );

      await runJob();

      should(delivered.filter(stat => stat.tags.type === 'meet')).eql([
        { namespace: 'offers', values: { count: 0 }, tags: { type: 'meet' } },
      ]);
    });

    it('skips language writes and logs when language counts fail', async function () {
      stubDeliver();
      stubStatistic(
        'getUserLanguagesCount',
        (limit: number, cb: (e: Error) => void) => cb(coded('E_LANG')),
      );

      const args = await runJob();

      should(args).eql([]);
      should(namespaces()).not.containEql('language');
      should(logged()).have.length(1);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal(
        'Daily statistics: failed fetching spoken languages counts.',
      );
      should(logged()[0][2]).have.property('code', 'E_LANG');
    });

    it('stops and logs both failures when a network count fails', async function () {
      stubDeliver();
      stubStatistic(
        'getExternalSiteCount',
        (site: string, cb: (e: Error | null, n?: number) => void) =>
          site === 'bewelcome' ? cb(coded('E_NET')) : cb(null, 40),
      );

      const args = await runJob();

      should(args).eql([]);
      should(
        delivered
          .filter(stat => stat.namespace === 'membersInNetworks')
          .map(stat => stat.tags.network),
      ).eql(['couchsurfing', 'warmshowers']);
      should(namespaces()).not.containEql('language');
      should(logged()).have.length(2);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal(
        'Daily statistics: failed fetching network "bewelcome" count.',
      );
      should(logged()[0][2]).have.property('code', 'E_NET');
      should(logged()[1][0]).equal('error');
      should(logged()[1][1]).equal('Daily statistics error');
      should(logged()[1][2]).have.property('code', 'E_NET');
    });

    it('stops and logs when a last-seen count fails', async function () {
      stubDeliver();
      stubStatistic(
        'getLastSeenStatistic',
        (since: unknown, cb: (e: Error) => void) => cb(coded('E_SEEN')),
      );

      const args = await runJob();

      should(args).eql([]);
      should(namespaces()).eql(['members']);
      should(logged()).have.length(1);
      should(logged()[0][0]).equal('error');
      should(logged()[0][1]).equal('Daily statistics error');
      should(logged()[0][2]).have.property('code', 'E_SEEN');
    });

    it('logs a general write failure for every statistic and still completes', async function () {
      stubDeliver(() => coded('E_WRITE'));

      const args = await runJob();

      should(args).eql([]);
      should(delivered).have.length(18);
      should(logged()).have.length(18);
      for (const entry of logged()) {
        should(entry[0]).equal('error');
        should(entry[1]).equal(
          'Daily statistics: failed writing to some endpoints.',
        );
        should(entry[2]).have.property('code', 'E_WRITE');
      }
    });

    it('logs only the influx error for an influx-specific write failure', async function () {
      stubDeliver(() => ({
        message: 'Writing to Influx service failed.',
        errors: { influx: coded('E_INFLUX') },
      }));

      await runJob();

      should(logged()).have.length(18);
      for (const entry of logged()) {
        should(entry[0]).equal('error');
        should(entry[1]).equal('Daily statistics: failed writing to influx');
        should(entry[2]).have.property('code', 'E_INFLUX');
      }
    });

    it('logs nothing for an influx-specific failure without influx details', async function () {
      stubDeliver(stat =>
        stat.namespace === 'members'
          ? { message: 'Writing to Influx service failed.' }
          : { message: 'Writing to Influx service failed.', errors: {} },
      );

      const args = await runJob();

      should(args).eql([]);
      should(delivered).have.length(18);
      should(logged()).eql([]);
    });

    it('logs a general failure when other errors carry influx details', async function () {
      stubDeliver(() => ({
        message: 'Something else failed',
        errors: { influx: coded('E_INFLUX') },
      }));

      await runJob();

      should(logged()).have.length(18);
      should(logged()[0][1]).equal(
        'Daily statistics: failed writing to some endpoints.',
      );
    });
  });
});
