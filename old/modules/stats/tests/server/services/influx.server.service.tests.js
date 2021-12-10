const path = require('path');
const should = require('should');
const sinon = require('sinon');
const influx = require('influx');
const Promise = require('promise');
// influx = require('influx'),
const influxService = require(path.resolve(
  './modules/stats/server/services/influx.server.service',
));
const config = require(path.resolve('./config/config'));

describe('Service: influx', function () {
  // restore the stubbed services
  afterEach(function () {
    sinon.restore();
  });

  context('InfluxDB disabled', function () {
    beforeEach(function () {
      // disable influx
      sinon.stub(config.influxdb, 'enabled').value(false);
    });

    it('Getting client returns error if no InfluxDB configured', function (done) {
      influxService._getClient(function (err) {
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
    beforeEach(function () {
      // stub the config to enable influx
      sinon.stub(config, 'influxdb').value({
        enabled: true,
        options: {
          // options are here to pass validation. InfluxDB is stubbed.
          host: 'example.com',
          port: 9876,
          protocol: 'https',
          database: 'example',
        },
      });

      // stub the influx.writeMeasurement method
      sinon.stub(influx.InfluxDB.prototype, 'writeMeasurement');

      // and it returns a Promise
      influx.InfluxDB.prototype.writeMeasurement.returns(
        new Promise(function (resolve) {
          process.nextTick(resolve());
        }),
      );
    });

    context('invalid data', function () {
      it('Writing point returns error with no measurementName', function (done) {
        influxService._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: no `measurementName` defined. #ghi3kH',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('Writing point returns error with no value', function (done) {
        influxService._writeMeasurement(
          'test',
          null,
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: no `fields` defined. #ghugGJ',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('Writing point returns error with no tag', function (done) {
        influxService._writeMeasurement(
          'test',
          { value: 1 },
          null,
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: no `tags` defined. #ghj3ig',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('Writing point returns error with wrong time format (nanoseconds)', function (done) {
        influxService._writeMeasurement(
          'test',
          { value: 1, time: 1475985480231035600 },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('Writing point returns error with wrong time format (milliseconds)', function (done) {
        influxService._writeMeasurement(
          'test',
          { value: 1, time: 1475985480231 },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('Writing point returns error with wrong time format (string)', function (done) {
        influxService._writeMeasurement(
          'test',
          { value: 1, time: '2016-10-09T03:58:00.231035600Z' },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.equal(
                'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });
    }); // end of context 'invalid data'

    context('valid data', function () {
      it('should reach influx.writeMeasurement method with proper data', function (done) {
        const validData = {
          namespace: 'messages',
          counts: {
            sent: 1,
          },
          values: {
            timeToFirstReply: 27364,
          },
          tags: {
            position: 'firstMessage',
            messageLengthType: 'long',
          },
          meta: {
            messageId: 'aabbccddee',
            messageLength: 345,
          },
        };

        influxService.stat(validData, function (e) {
          if (e) return done(e);
          try {
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);

            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            // check the validity of the stat object
            should(measurement).eql('messageSent');
            should(point)
              .have.propertyByPath('fields', 'timeToFirstReply')
              .eql(validData.values.timeToFirstReply);
            should(point)
              .have.propertyByPath('fields', 'messageId')
              .eql(validData.meta.messageId);
            should(point)
              .have.propertyByPath('fields', 'messageLength')
              .eql(validData.meta.messageLength);
            should(point)
              .have.propertyByPath('fields', 'sent')
              .eql(validData.counts.sent);
            should(point)
              .have.propertyByPath('tags', 'position')
              .eql(validData.tags.position);
            should(point)
              .have.propertyByPath('tags', 'messageLengthType')
              .eql(validData.tags.messageLengthType);

            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('[time provided as Date] should reach influx.writeMeasurement with properly formated and placed timestamp value (Date)', function (done) {
        const validData = {
          namespace: 'messages',
          counts: {
            sent: 1,
          },
          values: {
            value: 334,
          },
          time: new Date('2001-10-02'),
        };

        influxService.stat(validData, function (e) {
          if (e) return done(e);
          try {
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);

            const measurement =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
            const points =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
            should(points.length).eql(1);
            const point = points[0];

            should(measurement).eql('messageSent');
            should(point).not.have.propertyByPath('fields', 'time');
            should(point).have.property('timestamp', validData.time);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
    }); // end of context 'valid data'
  }); // end of context 'InfluxDB enabled'
});
