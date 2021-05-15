// test whether the daily statistics job reaches influxdb and stathat via Stats api

const should = require('should');
const path = require('path');
const influx = require('influx');
const stathat = require('stathat');
const sinon = require('sinon');
const _ = require('lodash');
const config = require(path.resolve('./config/config'));
const statsJob = require(path.resolve(
  './modules/statistics/server/jobs/daily-statistics.server.job',
));

describe('Daily Statistics Job - Unit Test', function () {
  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  // stub the influx and stathat endpoints
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

    // stub the stathat endpoints
    sinon.stub(stathat, 'trackEZValue');
    stathat.trackEZValue.callsArgAsync(3);
  });

  context('influxdb configured', function () {
    beforeEach(function () {
      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(false);

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

  context('stathat configured', function () {
    beforeEach(function () {
      // stub the config.stathat.key
      sinon.stub(config.stathat, 'key').value('stathatkey');

      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(true);

      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(false);
    });

    it('should reach stathat with data in correct format', function (done) {
      statsJob(null, function (e) {
        if (e) return done(e);

        try {
          // test stathat endpoint

          // Called total 4 times, twice per each stat call in job
          sinon.assert.callCount(stathat.trackEZValue, 68);

          // `getCall(0)` and `getCall(1)` contain calls for member count
          const memberGroupedArgs = _.zip.apply(this, [
            stathat.trackEZValue.getCall(0).args,
            stathat.trackEZValue.getCall(1).args,
          ]);

          // `getCall(2)` and `getCall(3)` contain calls for push registration count
          const pushGroupedArgs = _.zip.apply(this, [
            stathat.trackEZValue.getCall(2).args,
            stathat.trackEZValue.getCall(3).args,
          ]);

          // the first argument to the endpoint should be the stathat key
          should(memberGroupedArgs[0]).deepEqual([
            config.stathat.key,
            config.stathat.key,
          ]);
          should(pushGroupedArgs[0]).deepEqual([
            config.stathat.key,
            config.stathat.key,
          ]);

          // the 2nd argument to the endpoint should be the name
          _.forEach(
            [
              'members.count',
              'members.count.members.members', // with the members tag
            ],
            function (value) {
              should(memberGroupedArgs[1]).containEql(value);
            },
          );

          _.forEach(
            [
              'pushRegistrations.count',
              'pushRegistrations.count.type.all', // with the members tag
            ],
            function (value) {
              should(pushGroupedArgs[1]).containEql(value);
            },
          );

          // the 3rd argument to the endpoint should be a value (values)
          should(memberGroupedArgs[2]).deepEqual([0, 0]);
          should(pushGroupedArgs[2]).deepEqual([0, 0]);

          // the 4th argument to the endpoint is a callback
          _.forEach(memberGroupedArgs[3], function (arg) {
            should(arg).be.Function();
          });
          _.forEach(pushGroupedArgs[3], function (arg) {
            should(arg).be.Function();
          });

          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
});
