// Testing that when we send general proper data points to stats api,
// the correct data will arrive to the right endpoints (stathat, influx).

const should = require('should');
const path = require('path');
const _ = require('lodash');
const statsService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const config = require(path.resolve('./config/config'));
const influx = require('influx');
const stathat = require('stathat');
const sinon = require('sinon');

describe('Stat API integration tests', function () {
  // restoring stubs
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
    sinon.stub(stathat, 'trackEZCount');
    stathat.trackEZCount.callsArgWithAsync(3, 200, null);

    sinon.stub(stathat, 'trackEZCountWithTime');
    stathat.trackEZCountWithTime.callsArgWithAsync(4, 200, null);

    sinon.stub(stathat, 'trackEZValue');
    stathat.trackEZValue.callsArgWithAsync(3, 200, null);

    sinon.stub(stathat, 'trackEZValueWithTime');
    stathat.trackEZValueWithTime.callsArgWithAsync(4, 200, null);
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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count1').eql(1);
            should(point).have.propertyByPath('fields', 'count2').eql(2);
            should(point).have.propertyByPath('fields', 'value1').eql(3);
            should(point).have.propertyByPath('fields', 'value2').eql(4);
            should(point).not.have.property('timestamp');

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZCount, 2);
            sinon.assert.callCount(stathat.trackEZValue, 2);

            const calledWith0 = stathat.trackEZCount.getCall(0).args;
            const calledWith1 = stathat.trackEZCount.getCall(1).args;
            const calledWith2 = stathat.trackEZValue.getCall(0).args;
            const calledWith3 = stathat.trackEZValue.getCall(1).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith0[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name (counts)
            should([calledWith0[1], calledWith1[1]]).containEql('test.count1');
            should([calledWith0[1], calledWith1[1]]).containEql('test.count2');
            // the 3rd argument to the endpoint should be a value (counts)
            should([calledWith0[2], calledWith1[2]]).containEql(1);
            should([calledWith0[2], calledWith1[2]]).containEql(2);

            // the second argument to the endpoint should be the name (values)
            should([calledWith2[1], calledWith3[1]]).containEql('test.value1');
            should([calledWith2[1], calledWith3[1]]).containEql('test.value2');
            // the 3rd argument to the endpoint should be a value (values)
            should([calledWith2[2], calledWith3[2]]).containEql(3);
            should([calledWith2[2], calledWith3[2]]).containEql(4);

            // the 4th argument is a callback
            should(calledWith0[3]).be.Function();
            should(calledWith1[3]).be.Function();
            should(calledWith2[3]).be.Function();
            should(calledWith3[3]).be.Function();
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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count1').eql(1);
            should(point).have.propertyByPath('fields', 'count2').eql(2);
            should(point).have.propertyByPath('fields', 'value1').eql(3);
            should(point).have.propertyByPath('fields', 'value2').eql(4);
            // the timestamp should be also present
            should(point).have.property('timestamp').eql(data.time);

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZCountWithTime, 2);
            sinon.assert.callCount(stathat.trackEZValueWithTime, 2);

            const calledWith0 = stathat.trackEZCountWithTime.getCall(0).args;
            const calledWith1 = stathat.trackEZCountWithTime.getCall(1).args;
            const calledWith2 = stathat.trackEZValueWithTime.getCall(0).args;
            const calledWith3 = stathat.trackEZValueWithTime.getCall(1).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith0[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name (counts)
            should([calledWith0[1], calledWith1[1]]).containEql('test.count1');
            should([calledWith0[1], calledWith1[1]]).containEql('test.count2');
            // the 3rd argument to the endpoint should be a value (counts)
            should([calledWith0[2], calledWith1[2]]).containEql(1);
            should([calledWith0[2], calledWith1[2]]).containEql(2);

            // the second argument to the endpoint should be the name (values)
            should([calledWith2[1], calledWith3[1]]).containEql('test.value1');
            should([calledWith2[1], calledWith3[1]]).containEql('test.value2');
            // the 3rd argument to the endpoint should be a value (values)
            should([calledWith2[2], calledWith3[2]]).containEql(3);
            should([calledWith2[2], calledWith3[2]]).containEql(4);

            // the 4th argument to the endpoint should be a timestamp in seconds
            const secTime = data.time.getTime() / 1000;
            should(calledWith0[3]).eql(secTime);
            should(calledWith1[3]).eql(secTime);
            should(calledWith2[3]).eql(secTime);
            should(calledWith3[3]).eql(secTime);

            // the 5th argument is a callback
            should(calledWith0[4]).be.Function();
            should(calledWith1[4]).be.Function();
            should(calledWith2[4]).be.Function();
            should(calledWith3[4]).be.Function();
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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('test');
            should(point).have.propertyByPath('fields', 'count').eql(1);
            should(point).have.propertyByPath('fields', 'value').eql(2);
            should(point).not.have.property('timestamp');

            // test stathat endpoint
            // there are 3 points sent to stathat for count and value
            // 1 default and 1 for each tag (2)
            sinon.assert.callCount(stathat.trackEZCount, 3);
            sinon.assert.callCount(stathat.trackEZValue, 3);

            // collect the output from the stubbed stathat functions
            const countsCalledWith = _.map(_.range(3), function (i) {
              return stathat.trackEZCount.getCall(i).args;
            });
            const valuesCalledWith = _.map(_.range(3), function (i) {
              return stathat.trackEZValue.getCall(i).args;
            });

            const calledWith = _.concat(countsCalledWith, valuesCalledWith);

            // the first argument to the endpoint should be the stathat key
            // the 4th argument should be a callback function
            _.forEach(calledWith, function (args) {
              should(args[0]).equal(config.stathat.key);
              should(args[3]).be.Function();
            });

            // the second argument to the endpoint should be the name.tagname
            // we're not sure about the order in which they'll call the endpoint

            // separate the nth arguments into groups
            // the arguments grouped by their position
            // [1st arguments[], 2nd[], 3rd[], ...]
            const countGroupArgs = _.zip.apply(this, countsCalledWith);
            const valueGroupArgs = _.zip.apply(this, valuesCalledWith);

            // *** counts ***
            _.forEach(
              [
                // the expected names
                'test.count',
                'test.count.tag1.string1',
                'test.count.tag2.string2',
              ],
              function (value) {
                // the 2nd arguments of the countsCalledWith
                should(countGroupArgs[1]).containEql(value);
              },
            );

            // the third argument should be a value
            // here array of values from each call
            should(countGroupArgs[2]).deepEqual([1, 1, 1]);

            // *** values ***
            _.forEach(
              [
                // the expected names
                'test.value',
                'test.value.tag1.string1',
                'test.value.tag2.string2',
              ],
              function (value) {
                // the 2nd arguments of the countsCalledWith
                should(valueGroupArgs[1]).containEql(value);
              },
            );

            // the third argument should be a value
            // here array of values from each call
            should(valueGroupArgs[2]).deepEqual([2, 2, 2]);

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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
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

            // test stathat endpoint
            // in stathat the meta are ignored
            // so count and value endpoints are called just once
            sinon.assert.callCount(stathat.trackEZCount, 1);
            sinon.assert.callCount(stathat.trackEZValue, 1);

            // collect the output from the stubbed stathat functions
            const countCalledWith = stathat.trackEZCount.getCall(0).args;
            const valueCalledWith = stathat.trackEZValue.getCall(0).args;

            should(countCalledWith[1]).equal('test.count');
            should(valueCalledWith[1]).equal('test.value');

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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testCount');
            should(point).have.propertyByPath('fields', 'count').eql(3.5);
            should(point).not.have.propertyByPath('fields', 'value');
            // the timestamp should not be present
            should(point).not.have.property('timestamp');

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZCount, 1);
            sinon.assert.callCount(stathat.trackEZValue, 0);

            const calledWith = stathat.trackEZCount.getCall(0).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name
            should(calledWith[1]).equal('testCount.count');

            // the 3rd argument to the endpoint should be a value
            should(calledWith[2]).equal(3.5);

            // the 4th argument is a callback
            should(calledWith[3]).be.Function();

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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testCountWithTime');
            should(point).have.propertyByPath('fields', 'count').eql(2.6);
            should(point).not.have.propertyByPath('fields', 'value');
            // the timestamp should be also present
            should(point).have.property('timestamp', testDate);

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZCountWithTime, 1);

            const calledWith = stathat.trackEZCountWithTime.getCall(0).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name
            should(calledWith[1]).equal('testCountWithTime.count');

            // the 3rd argument to the endpoint should be a value
            should(calledWith[2]).equal(2.6);

            // the 4th argument is a timestamp in seconds
            const secTimestamp = testDate.getTime() / 1000;
            should(calledWith[3]).equal(secTimestamp);

            // the 5th argument is a callback
            should(calledWith[4]).be.Function();

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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testValue');
            should(point).have.propertyByPath('fields', 'value').eql(13.31);
            should(point).not.have.propertyByPath('fields', 'count');
            // the timestamp should not be present
            should(point).not.have.property('timestamp');

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZCount, 0);
            sinon.assert.callCount(stathat.trackEZValue, 1);

            const calledWith = stathat.trackEZValue.getCall(0).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name
            should(calledWith[1]).equal('testValue.value');

            // the 3rd argument to the endpoint should be a value
            should(calledWith[2]).equal(13.31);

            // the 4th argument is a callback
            should(calledWith[3]).be.Function();

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
            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('testValueWithTime');
            should(point).have.propertyByPath('fields', 'value').eql(-3.78);
            should(point).not.have.propertyByPath('fields', 'count');
            // the timestamp should be also present
            should(point).have.property('timestamp', testDate);

            // test stathat endpoint
            sinon.assert.callCount(stathat.trackEZValueWithTime, 1);

            const calledWith = stathat.trackEZValueWithTime.getCall(0).args;

            // the first argument to the endpoint should be the stathat key
            should(calledWith[0]).equal(config.stathat.key);

            // the second argument to the endpoint should be the name
            should(calledWith[1]).equal('testValueWithTime.value');

            // the 3rd argument to the endpoint should be a value
            should(calledWith[2]).equal(-3.78);

            // the 4th argument is a timestamp in seconds
            const secTimestamp = testDate.getTime() / 1000;
            should(calledWith[3]).equal(secTimestamp);

            // the 5th argument is a callback
            should(calledWith[4]).be.Function();

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
            sinon.assert.callCount(stathat.trackEZCount, 0);
            sinon.assert.callCount(stathat.trackEZValue, 0);
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
            sinon.assert.callCount(stathat.trackEZCount, 0);
            sinon.assert.callCount(stathat.trackEZValue, 0);
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
            sinon.assert.callCount(stathat.trackEZCount, 0);
            sinon.assert.callCount(stathat.trackEZValue, 0);
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
            sinon.assert.callCount(stathat.trackEZCount, 0);
            sinon.assert.callCount(stathat.trackEZValue, 0);
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
      // stub the config.stathat.key
      sinon.stub(config.stathat, 'key').value('stathatkey');

      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(true);

      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(false);
    });

    it('send only to stathat, influx ignored without error', function (done) {
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
            sinon.assert.callCount(stathat.trackEZCount, 1);

            return done();
          } catch (e) {
            return done(e);
          }
        },
      );
    });
  });

  context('stathat disabled', function () {
    beforeEach(function () {
      // stub the config.stathat.key
      sinon.stub(config.stathat, 'key').value('stathatkey');

      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(false);

      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('send only to influx, stathat ignored without error', function (done) {
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
              1,
            );
            sinon.assert.callCount(stathat.trackEZCount, 0);

            return done();
          } catch (e) {
            return done(e);
          }
        },
      );
    });
  });
});
