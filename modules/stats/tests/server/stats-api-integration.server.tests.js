// Testing that when we send general proper data points to stats api,
// the correct data will arrive to the InfluxDB endpoint

const should = require('should');
const path = require('path');
const influx = require('influx');
const sinon = require('sinon');

const statsService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const config = require(path.resolve('./config/config'));

describe('Stat API integration tests', function () {
  // restoring stubs
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

  context('endpoints enabled', function () {
    beforeEach(function () {
      // stub the config.stathat.key
      sinon.stub(config.stathat, 'key').value('stathatkey');

      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(true);

      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    context('valid data', function () {
      it('correct data arrive to the endpoints', function (done) {
        // the testing data
        const data = {
          namespace: 'test',
          counts: {
            count1: 1,
            count2: 2,
          },
          values: {
            value1: 3,
            value2: 4,
          },
        };

        // call the stat api with the testing data
        statsService.stat(data, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count1').eql(1);
            should(point).have.propertyByPath('fields', 'count2').eql(2);
            should(point).have.propertyByPath('fields', 'value1').eql(3);
            should(point).have.propertyByPath('fields', 'value2').eql(4);
            should(point).not.have.property('timestamp');

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[with time] correct data arrive to the endpoints', function (done) {
        // the testing data
        const data = {
          namespace: 'test',
          counts: {
            count1: 1,
            count2: 2,
          },
          values: {
            value1: 3,
            value2: 4,
          },
          time: new Date('2012-12-21 13:41:01.134'),
        };

        // call the stat api with the testing data
        statsService.stat(data, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count1').eql(1);
            should(point).have.propertyByPath('fields', 'count2').eql(2);
            should(point).have.propertyByPath('fields', 'value1').eql(3);
            should(point).have.propertyByPath('fields', 'value2').eql(4);
            // the timestamp should be also present
            should(point).have.property('timestamp').eql(data.time);

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[with tags] correct data arrive to the endpoints', function (done) {
        // the testing data
        const data = {
          namespace: 'test',
          counts: {
            count: 1,
          },
          values: {
            value: 2,
          },
          tags: {
            tag1: 'string1',
            tag2: 'string2',
          },
        };

        // call the stat api with the testing data
        statsService.stat(data, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count').eql(1);
            should(point).have.propertyByPath('fields', 'value').eql(2);
            should(point).not.have.property('timestamp');

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[with metadata] correct data arrive to the endpoints', function (done) {
        // the testing data
        const data = {
          namespace: 'test',
          counts: {
            count: 1,
          },
          values: {
            value: 2,
          },
          meta: {
            meta1: 'meta string',
            meta2: 3,
          },
        };

        // call the stat api with the testing data
        statsService.stat(data, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count').eql(1);
            should(point).have.propertyByPath('fields', 'value').eql(2);
            should(point)
              .have.propertyByPath('fields', 'meta1')
              .eql('meta string');
            should(point).have.propertyByPath('fields', 'meta2').eql(3);
            should(point).not.have.property('timestamp');

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[count] correct data arrive to the endpoints', function (done) {
        // call the stat api count
        statsService.count('testCount', 3.5, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testCount');
            should(point).have.propertyByPath('fields', 'count').eql(3.5);
            should(point).not.have.propertyByPath('fields', 'value');
            // the timestamp should not be present
            should(point).not.have.property('timestamp');

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[count with time] correct data arrive to the endpoints', function (done) {
        // call the stat api count(namespace, number, date, callback)
        const testDate = new Date('2016-01-31 5:31:01.221');
        statsService.count('testCountWithTime', 2.6, testDate, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testCountWithTime');
            should(point).have.propertyByPath('fields', 'count').eql(2.6);
            should(point).not.have.propertyByPath('fields', 'value');
            // the timestamp should be also present
            should(point).have.property('timestamp', testDate);

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[value] correct data arrive to the endpoints', function (done) {
        // call the stat api count
        statsService.value('testValue', 13.31, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testValue');
            should(point).have.propertyByPath('fields', 'value').eql(13.31);
            should(point).not.have.propertyByPath('fields', 'count');
            // the timestamp should not be present
            should(point).not.have.property('timestamp');

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
      it('[value with time] correct data arrive to the endpoints', function (done) {
        // call the stat api value(namespace, number, date, callback)
        const testDate = new Date('2016-01-30 5:32:01.221');
        statsService.value('testValueWithTime', -3.78, testDate, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
              0,
            ).args[0];
            const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
              .args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testValueWithTime');
            should(point).have.propertyByPath('fields', 'value').eql(-3.78);
            should(point).not.have.propertyByPath('fields', 'count');
            // the timestamp should be also present
            should(point).have.property('timestamp', testDate);

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
    });

    context('invalid data', function () {
      it('[duplicate property] should call callback with error', function (done) {
        const invalidData = {
          namespace: 'test',
          counts: {
            sameName: 3,
          },
          values: {
            sameName: 2,
          },
        };

        // call the stat api with the testing data
        statsService.stat(invalidData, function (e) {
          try {
            should(e).be.Error();
            should(e).have.property(
              'message',
              'Every key of stat counts, values, meta and tags must be unique',
            );

            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              0,
            );

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[missing count or value] should call callback with error', function (done) {
        const invalidData = {
          namespace: 'test',
          counts: {},
          meta: {
            meta1: 1,
          },
        };

        // call the stat api with the testing data
        statsService.stat(invalidData, function (e) {
          try {
            should(e).be.Error();
            should(e).have.property(
              'message',
              'The stat should contain counts or values',
            );

            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              0,
            );

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[invalid datatype] should call callback with error', function (done) {
        const invalidData = {
          namespace: 'test',
          counts: {
            stringCount: 'string',
          },
        };

        // call the stat api with the testing data
        statsService.stat(invalidData, function (e) {
          try {
            should(e).be.Error();
            should(e).have.property(
              'message',
              'Each of counts and values should be a number',
            );

            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              0,
            );

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[invalid time format] should call callback with error', function (done) {
        const data = {
          namespace: 'invalidTime',
          values: {
            v1: 5,
          },
          time: 123456,
        };
        // call the stat api with the testing data
        statsService.stat(data, function (e) {
          try {
            should(e).be.Error();
            should(e).have.property(
              'message',
              'Time must be a Date object or not provided',
            );

            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              0,
            );

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
    });
  });

  context('influx disabled', function () {
    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(false);
    });

    it('influx ignored without error', function (done) {
      statsService.stat(
        {
          namespace: 'test',
          counts: {
            c: 1,
          },
        },
        function (e) {
          if (e) return done(e);
          try {
            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              0,
            );

            return done();
          } catch (e) {
            return done(e);
          }
        },
      );
    });
  });
});
