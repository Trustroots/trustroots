// test whether the daily statistics job reaches influxdb via Stats api

const should = require('should');
const path = require('path');
const influx = require('influx');
const sinon = require('sinon');

const config = require('../../../../../config/config');
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
    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
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
