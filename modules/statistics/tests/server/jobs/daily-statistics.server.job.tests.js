// test whether the daily statistics job reaches influxdb via Stats api

const should = require('should');
const influx = require('influx');
const sinon = require('sinon');

const config = require('../../../../../config/config');
const statsService = require('../../../../stats/server/services/stats.server.service');
const statsJob = require('../../../server/jobs/daily-statistics.server.job');

describe('Daily Statistics Job - Unit Test', function () {
  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  // stub the influx endpoint
  beforeEach(function () {
    // stub the influx endpoint(s)
    sinon.stub(influx.InfluxDB.prototype, 'writeMeasurement');

    // and writeMeasurement returns a Promise
    influx.InfluxDB.prototype.writeMeasurement.returns(
      new Promise(function (resolve) {
        process.nextTick(resolve());
      }),
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
    const statistics = require('../../../server/controllers/statistics.server.controller');

    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('continues when fetching the user count fails', function (done) {
      sinon
        .stub(statistics, 'getUsersCount')
        .callsFake(cb => cb(new Error('db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching push registration count fails', function (done) {
      sinon
        .stub(statistics, 'getPushRegistrationCount')
        .callsFake(cb => cb(new Error('push db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching host offer counts fails', function (done) {
      sinon
        .stub(statistics, 'getHostOffersCount')
        .callsFake(cb => cb(new Error('offers db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching meet offer count fails', function (done) {
      sinon
        .stub(statistics, 'getMeetOffersCount')
        .callsFake(cb => cb(new Error('meet db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when fetching spoken language counts fails', function (done) {
      sinon
        .stub(statistics, 'getUserLanguagesCount')
        .callsFake((limit, cb) => cb(new Error('languages db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('writes language statistics when spoken language counts are available', function (done) {
      sinon.stub(statistics, 'getUserLanguagesCount').callsFake((limit, cb) =>
        cb(null, [
          { _id: 'en', count: 3 },
          { _id: 'fi', count: 1 },
        ]),
      );
      sinon.stub(statistics, 'getUsersCount').callsFake(cb => cb(null, 4));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when collecting last-seen statistics fails', function (done) {
      sinon
        .stub(statistics, 'getLastSeenStatistic')
        .callsFake((since, cb) => cb(new Error('last seen db down')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('logs and completes when a network count fails', function (done) {
      const original = statistics.getExternalSiteCount;
      statistics.getExternalSiteCount = function (site, cb) {
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
        .stub(statsService, 'stat')
        .callsFake((statObject, cb) => cb(new Error('influx unavailable')));

      statsJob(null, function (e) {
        if (e) return done(e);
        done();
      });
    });

    it('continues when writing to influx fails with an influx-specific error', function (done) {
      sinon.stub(statsService, 'stat').callsFake((statObject, cb) =>
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

    it('should reach the influxdb with data in correct format', function (done) {
      statsJob(null, function (e) {
        if (e) return done(e);

        try {
          // test influx endpoint

          // Called total 2 times, once per each stat call in job
          sinon.assert.callCount(
            influx.InfluxDB.prototype.writeMeasurement,
            17,
          );

          // Member count stat point
          const memberMeasurement =
            influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
          const memberPoints =
            influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
          const memberPoint = memberPoints[0];
          should(memberPoints.length).eql(1);
          should(memberMeasurement).eql('members');
          should(memberPoint).have.propertyByPath('fields', 'count').eql(0);
          should(memberPoint)
            .have.propertyByPath('tags', 'members')
            .eql('members');
          should(memberPoint).not.have.property('timestamp');

          // Push registration count stat point
          const pushMeasurement =
            influx.InfluxDB.prototype.writeMeasurement.getCall(1).args[0];
          const pushPoints =
            influx.InfluxDB.prototype.writeMeasurement.getCall(1).args[1];
          const pushPoint = pushPoints[0];
          should(pushPoints.length).eql(1);
          should(pushMeasurement).eql('pushRegistrations');
          should(pushPoint).have.propertyByPath('fields', 'count').eql(0);
          should(pushPoint).have.propertyByPath('tags', 'type').eql('all');
          should(pushPoint).not.have.property('timestamp');

          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
});
