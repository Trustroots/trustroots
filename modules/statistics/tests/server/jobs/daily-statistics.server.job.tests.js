'use strict';

// test whether the daily statistics job reaches influxdb and stathat via Stats api

var should = require('should'),
    path = require('path'),
    influx = require('influx'),
    stathat = require('stathat'),
    sinon = require('sinon'),
    _ = require('lodash'),
    config = require(path.resolve('./config/config')),
    statsJob = require(path.resolve('./modules/statistics/server/jobs/daily-statistics.server.job'));

describe('Daily Statistics Job - Unit Test', function () {
  // replace the influx & stathat service stat() functions with fake version
  var sandbox;

  // initializing and clearing the sinon sandbox
  beforeEach(function () {
    // sandboxing in sinon helps restore the spied/stubbed/mocked functions
    sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    // restore the stubbed services
    sandbox.restore();
  });

  // stub the influx and stathat endpoints
  beforeEach(function () {
    // stub the influx endpoint(s)
    sandbox.stub(influx.InfluxDB.prototype, 'writeMeasurement');

    // and writeMeasurement returns a Promise
    influx.InfluxDB.prototype.writeMeasurement.returns(
      new Promise(function (resolve) {
        process.nextTick(resolve());
      })
    );

    // provide config options for influxdb
    sandbox.stub(config.influxdb, 'options', {
      host: 'localhost',
      port: 8086,
      protocol: 'http',
      database: 'trustroots-test'
    });

    // stub the stathat endpoints
    sandbox.stub(stathat, 'trackEZValue');
    stathat.trackEZValue.callsArgAsync(3);
  });

  context('influxdb configured', function () {
    beforeEach(function () {
      // stub the config.stathat.key
      // sandbox.stub(config.stathat, 'key', 'stathatkey');

      // stub enable stathat in config
      sandbox.stub(config.stathat, 'enabled', false);

      // stub enable influx in config
      sandbox.stub(config.influxdb, 'enabled', true);
    });

    it('should reach the influxdb with data in correct format', function (done) {
      statsJob(null, function (e) {
        if (e) return done(e);

        try {
          // test influx endpoint
          sinon.assert.callCount(influx.InfluxDB.prototype.writeMeasurement, 1);

          var measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
          var points = influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
          should(points.length).eql(1);
          var point = points[0];

          should(measurement).eql('members');
          should(point).have.propertyByPath('fields', 'count').eql(0);
          should(point).have.propertyByPath('tags', 'members').eql('members');
          should(point).not.have.property('timestamp');

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
      sandbox.stub(config.stathat, 'key', 'stathatkey');

      // stub enable stathat in config
      sandbox.stub(config.stathat, 'enabled', true);

      // stub enable influx in config
      sandbox.stub(config.influxdb, 'enabled', false);
    });

    it('should reach stathat with data in correct format', function (done) {
      statsJob(null, function (e) {
        if (e) return done(e);

        try {
          // test stathat endpoint
          sinon.assert.callCount(stathat.trackEZValue, 2);

          var calledWith = [
            stathat.trackEZValue.getCall(0).args,
            stathat.trackEZValue.getCall(1).args
          ];

          var groupedArgs = _.zip.apply(this, calledWith);

          // the first argument to the endpoint should be the stathat key
          should(groupedArgs[0]).deepEqual([config.stathat.key, config.stathat.key]);

          // the 2nd argument to the endpoint should be the name
          _.forEach([
            'members.count',
            'members.count.members.members' // with the members tag
          ], function (value) {
            should(groupedArgs[1]).containEql(value);
          });

          // the 3rd argument to the endpoint should be a value (values)
          should(groupedArgs[2]).deepEqual([0, 0]);

          // the 4th argument to the endpoint is a callback
          _.forEach(groupedArgs[3], function (arg) {
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
