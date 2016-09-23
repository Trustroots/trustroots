'use strict';

require('should');

var path = require('path'),
    influxService = require(path.resolve('./modules/core/server/services/influx.server.service'));

describe('Service: influx', function() {

  it('Getting client returns error if no InfluxDB configured', function(done) {
    influxService.getClient(function(err) {
      err.message.should.equal('No InfluxDB configured.');
      done();
    });
  });

  it('Writing point returns error with no seriesName', function(done) {
    influxService.writePoint(null, 1, { 'tag': 'tag' }, function(err) {
      err.message.should.equal('InfluxDB Service: no `seriesName` defined.');
      done();
    });
  });

  it('Writing point returns error with no value', function(done) {
    influxService.writePoint('test', null, { 'tag': 'tag' }, function(err) {
      err.message.should.equal('InfluxDB Service: no `values` defined.');
      done();
    });
  });

  it('Writing point returns error with no tag', function(done) {
    influxService.writePoint('test', 1, null, function(err) {
      err.message.should.equal('InfluxDB Service: no `tags` defined.');
      done();
    });
  });

  /*
  it('Writing point should succeed with 0 value', function(done) {
    influxService.writePoint('test', 0, { 'tag':'tag' }, function(err) {
      err.message.should.equal('InfluxDB Service: No `values` defined.');
      done();
    });
  });
  */

});
