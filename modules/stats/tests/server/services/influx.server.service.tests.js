'use strict';

require('should');

var path = require('path'),
    sinon = require('sinon'),
    // influx = require('influx'),
    influxService = require(path.resolve('./modules/stats/server/services/influx.server.service')),
    config = require(path.resolve('./config/config'));

describe('Service: influx', function() {

  context('InfluxDB disabled', function () {
    var sandbox;

    beforeEach(function () {
      // sandboxing in sinon helps restore the spied/stubbed/mocked functions and parameters
      sandbox = sinon.sandbox.create();

      sandbox.stub(config.influxdb, 'enabled', false);
    });

    afterEach(function () {
      // restore the stubbed services
      sandbox.restore();
    });

    it('Getting client returns error if no InfluxDB configured', function(done) {
      influxService._getClient(function(err) {
        try {
          err.message.should.equal('No InfluxDB configured.');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });

  context('InfluxDB enabled', function () {
    var sandbox;

    beforeEach(function () {
      // sandboxing in sinon helps restore the spied/stubbed/mocked functions and parameters
      sandbox = sinon.sandbox.create();

      sandbox.stub(config.influxdb, 'enabled', true);
    });

    afterEach(function () {
      // restore the stubbed services
      sandbox.restore();
    });

    context('invalid data', function () {
      it('Writing point returns error with no measurementName', function(done) {
        influxService._writeMeasurement(null, { value: 1 }, { tag: 'tag' }, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: no `measurementName` defined. #ghi3kH');
            return done();

          } catch (e) {
            return done(e);
          }
        });
      });

      it('Writing point returns error with no value', function(done) {
        influxService._writeMeasurement('test', null, { tag: 'tag' }, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: no `fields` defined. #ghugGJ');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('Writing point returns error with no tag', function(done) {
        influxService._writeMeasurement('test', { value: 1 }, null, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: no `tags` defined. #ghj3ig');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('Writing point returns error with wrong time format (nanoseconds)', function(done) {
        influxService._writeMeasurement('test', { value: 1, time: 1475985480231035600 }, { tag: 'tag' }, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
            return done();

          } catch (e) {
            return done(e);
          }
        });
      });

      it('Writing point returns error with wrong time format (milliseconds)', function(done) {
        influxService._writeMeasurement('test', { value: 1, time: 1475985480231 }, { tag: 'tag' }, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
            return done();

          } catch (e) {
            return done(e);
          }
        });
      });

      it('Writing point returns error with wrong time format (string)', function(done) {
        influxService._writeMeasurement('test', { value: 1, time: '2016-10-09T03:58:00.231035600Z' }, { tag: 'tag' }, function(err) {
          try {
            err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
            return done();

          } catch (e) {
            return done(e);
          }
        });
      });

    });

    context('valid data', function () {
      it('should reach influx.writeMeasurement method with proper data');

      it('[time provided as Date] should reach influx.writeMeasurement with properly formated and placed timestamp value (Date)');
    });
  });
});
