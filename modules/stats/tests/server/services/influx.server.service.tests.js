const should = require('should');
const sinon = require('sinon');
const influx = require('influx');
const Promise = require('promise');
const proxyquire = require('proxyquire').noCallThru();
// influx = require('influx'),
const influxService = require('../../../server/services/influx.server.service');
const config = require('../../../../../config/config');

const servicePath = '../../../server/services/influx.server.service';

function loadInfluxServiceWithLogger(logger) {
  return proxyquire(servicePath, {
    '../../../../config/lib/logger': logger,
  });
}

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

    it('stat() finishes without error when InfluxDB is disabled', function (done) {
      influxService.stat(
        { namespace: 'supportRequest', counts: { count: 1 } },
        function (err) {
          try {
            should.not.exist(err);
            return done();
          } catch (e) {
            return done(e);
          }
        },
      );
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

      it('logs validation failures outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (measurementErr) {
            service._writeMeasurement(
              'test',
              null,
              { tag: 'tag' },
              function (fieldsErr) {
                service._writeMeasurement(
                  'test',
                  { value: 1 },
                  null,
                  function (tagsErr) {
                    service._writeMeasurement(
                      'test',
                      { value: 1, time: 'bad-time' },
                      { tag: 'tag' },
                      function (timeErr) {
                        process.env.NODE_ENV = originalEnv;

                        try {
                          measurementErr.message.should.containEql(
                            'no `measurementName`',
                          );
                          fieldsErr.message.should.containEql('no `fields`');
                          tagsErr.message.should.containEql('no `tags`');
                          timeErr.message.should.containEql(
                            'expected `fields.time`',
                          );
                          sinon.assert.callCount(logger, 4);
                          return done();
                        } catch (e) {
                          return done(e);
                        }
                      },
                    );
                  },
                );
              },
            );
          },
        );
      });

      it('restores NODE_ENV when logging validation assertions fail', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const service = loadInfluxServiceWithLogger(sinon.stub());

        service._writeMeasurement('test', null, { tag: 'tag' }, function (err) {
          process.env.NODE_ENV = originalEnv;

          try {
            err.message.should.containEql('no `fields`');
            process.env.NODE_ENV.should.equal(originalEnv);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

      it('logs measurement name validation failures outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            process.env.NODE_ENV = originalEnv;

            try {
              err.message.should.containEql('no `measurementName`');
              sinon.assert.calledOnce(logger);
              logger.firstCall.args[1].should.equal(
                'InfluxDB Service: no `measurementName` defined. #ghi3kH',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('logs field and tag validation context outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          'testMeasurement',
          null,
          { tag: 'tag' },
          function (fieldsErr) {
            service._writeMeasurement(
              'testMeasurement',
              { value: 1 },
              null,
              function (tagsErr) {
                process.env.NODE_ENV = originalEnv;

                try {
                  fieldsErr.message.should.containEql('no `fields`');
                  tagsErr.message.should.containEql('no `tags`');
                  sinon.assert.calledTwice(logger);
                  logger.firstCall.args[2].measurement.should.equal(
                    'testMeasurement',
                  );
                  logger.secondCall.args[2].measurement.should.equal(
                    'testMeasurement',
                  );
                  return done();
                } catch (e) {
                  return done(e);
                }
              },
            );
          },
        );
      });

      it('logs invalid time validation context outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          'testMeasurement',
          { value: 1, time: 'bad-time' },
          { tag: 'tag' },
          function (err) {
            process.env.NODE_ENV = originalEnv;

            try {
              err.message.should.containEql('expected `fields.time`');
              sinon.assert.calledOnce(logger);
              logger.firstCall.args[2].measurement.should.equal(
                'testMeasurement',
              );
              logger.firstCall.args[2].time.should.equal('bad-time');
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('does not log validation failures while running in test mode', function (done) {
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.containEql('no `measurementName`');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('does not log invalid field validation while running in test mode', function (done) {
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          'testMeasurement',
          null,
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.containEql('no `fields`');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('does not log invalid tag validation while running in test mode', function (done) {
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          'testMeasurement',
          { value: 1 },
          null,
          function (err) {
            try {
              err.message.should.containEql('no `tags`');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('does not log invalid time validation while running in test mode', function (done) {
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          'testMeasurement',
          { value: 1, time: 'bad-time' },
          { tag: 'tag' },
          function (err) {
            try {
              err.message.should.containEql('expected `fields.time`');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('continues validation logging after NODE_ENV switches back from test', function (done) {
        const originalEnv = process.env.NODE_ENV;
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (testModeErr) {
            process.env.NODE_ENV = 'development';
            service._writeMeasurement(
              null,
              { value: 1 },
              { tag: 'tag' },
              function (devModeErr) {
                process.env.NODE_ENV = originalEnv;

                try {
                  testModeErr.message.should.containEql('no `measurementName`');
                  devModeErr.message.should.containEql('no `measurementName`');
                  sinon.assert.calledOnce(logger);
                  return done();
                } catch (e) {
                  return done(e);
                }
              },
            );
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

      it('uses the namespace as the measurement name for non-message stats', function (done) {
        influxService.stat(
          {
            namespace: 'supportRequest',
            counts: { count: 1 },
            tags: { type: 'normal' },
          },
          function (e) {
            if (e) return done(e);
            try {
              const measurement =
                influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
              measurement.should.equal('supportRequest');
              done();
            } catch (err) {
              done(err);
            }
          },
        );
      });

      it('allows writeMeasurement success without a callback', function (done) {
        influxService._writeMeasurement('test', { value: 1 }, { tag: 'tag' });

        process.nextTick(function () {
          try {
            sinon.assert.calledOnce(influx.InfluxDB.prototype.writeMeasurement);
            done();
          } catch (err) {
            done(err);
          }
        });
      });

      it('propagates writeMeasurement client errors', function (done) {
        sinon.stub(influxService, '_getClient').callsFake(cb => {
          cb(new Error('client fail'));
        });

        influxService._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            err.message.should.equal('client fail');
            done();
          },
        );
      });

      it('propagates writeMeasurement promise rejections', function (done) {
        influx.InfluxDB.prototype.writeMeasurement.returns(
          Promise.reject(new Error('write failed')),
        );

        influxService._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            err.message.should.equal('write failed');
            done();
          },
        );
      });

      it('logs writeMeasurement promise rejections outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);
        influx.InfluxDB.prototype.writeMeasurement.returns(
          Promise.reject(new Error('write failed')),
        );

        service._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            process.env.NODE_ENV = originalEnv;

            try {
              err.message.should.equal('write failed');
              sinon.assert.calledOnce(logger);
              logger.firstCall.args[1].should.equal(
                'InfluxDB Service: Error while writing to InfluxDB #fj38hh',
              );
              done();
            } catch (e) {
              done(e);
            }
          },
        );
      });
    }); // end of context 'valid data'
  }); // end of context 'InfluxDB enabled'
});
