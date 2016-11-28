'use strict';

require('should');

var path = require('path'),
    influxService = require(path.resolve('./modules/core/server/services/influx.server.service')),
    config = require(path.resolve('./config/config'));

describe('Service: influx', function() {

  context('InfluxDB disabled', function () {
    var originalInfluxSettings;

    before(function () {
      originalInfluxSettings = config.influxdb.enabled;
      config.influxdb.enabled = false;
    });

    after(function () {
      config.influxdb.enabled = originalInfluxSettings;
    });

    it('Getting client returns error if no InfluxDB configured', function(done) {
      influxService.getClient(function(err) {
        try {
          err.message.should.equal('No InfluxDB configured.');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });

  it('Writing point returns error with no measurementName', function(done) {
    influxService.writeMeasurement(null, { value: 1 }, { tag: 'tag' }, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: no `measurementName` defined. #ghi3kH');
        return done();

      } catch (e) {
        return done(e);
      }
    });
  });

  it('Writing point returns error with no value', function(done) {
    influxService.writeMeasurement('test', null, { tag: 'tag' }, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: no `fields` defined. #ghugGJ');
        return done();
      } catch (e) {
        return done(e);
      }
    });
  });

  it('Writing point returns error with no tag', function(done) {
    influxService.writeMeasurement('test', { value: 1 }, null, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: no `tags` defined. #ghj3ig');
        return done();
      } catch (e) {
        return done(e);
      }
    });
  });

  it('Writing point returns error with wrong time format (nanoseconds)', function(done) {
    influxService.writeMeasurement('test', { value: 1, time: 1475985480231035600 }, { tag: 'tag' }, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
        return done();

      } catch (e) {
        return done(e);
      }
    });
  });

  it('Writing point returns error with wrong time format (milliseconds)', function(done) {
    influxService.writeMeasurement('test', { value: 1, time: 1475985480231 }, { tag: 'tag' }, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
        return done();

      } catch (e) {
        return done(e);
      }
    });
  });

  it('Writing point returns error with wrong time format (string)', function(done) {
    influxService.writeMeasurement('test', { value: 1, time: '2016-10-09T03:58:00.231035600Z' }, { tag: 'tag' }, function(err) {
      try {
        err.message.should.equal('InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh');
        return done();

      } catch (e) {
        return done(e);
      }
    });
  });

});
