const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');
const influx: typeof import('influx') = require('influx');
const winston: typeof import('winston') = require('winston');
// influx = require('influx'),
type InfluxService =
  typeof import('../../../server/services/influx.server.service.mts').default;
type InfluxCallback = (error?: Error | null) => void;
type TestInfluxService = Omit<InfluxService, '_writeMeasurement'> & {
  _writeMeasurement(
    measurementName: string | null,
    fields: Record<string, unknown> | null,
    tags: Record<string, unknown> | null,
    callback?: InfluxCallback,
  ): void;
};
const influxService =
  require('./../../../server/services/influx.server.service.mts') as TestInfluxService;
const config =
  require('./../../../../../config/config.mts') as typeof import('../../../../../config/config.mts').default;
type WriteMeasurementArgs = [
  string,
  import('influx').IPoint[],
  import('influx').IWriteOptions?,
];
type WriteMeasurementStub = import('sinon').SinonStub<
  WriteMeasurementArgs,
  Promise<void>
>;

function writeMeasurementStub(): WriteMeasurementStub {
  return (
    influx.InfluxDB.prototype as unknown as {
      writeMeasurement: WriteMeasurementStub;
    }
  ).writeMeasurement;
}

function stubWriteMeasurement(): WriteMeasurementStub {
  return sinon.stub(
    influx.InfluxDB.prototype,
    'writeMeasurement',
  ) as unknown as WriteMeasurementStub;
}

function loadInfluxServiceWithLogger(
  logger: (
    ...args: Parameters<typeof winston.Logger.prototype.log>
  ) => ReturnType<typeof winston.Logger.prototype.log>,
): TestInfluxService {
  sinon.stub(winston.Logger.prototype, 'log').callsFake(logger);
  return influxService;
}

describe('Service: influx', function () {
  // restore the stubbed services
  afterEach(function () {
    sinon.restore();
  });

  it('keeps the CommonJS adapter identical to the ESM default and named exports', async function () {
    const esmService =
      await import('../../../server/services/influx.server.service.mts');

    esmService.default.should.equal(influxService);
    (['stat', '_getClient', '_writeMeasurement'] as const).forEach(
      function (name) {
        esmService.default[name].should.equal(esmService[name]);
      },
    );
  });

  context('InfluxDB disabled', function () {
    beforeEach(function () {
      // disable influx
      sinon.stub(config.influxdb, 'enabled').value(false);
    });

    it('Getting client returns error if no InfluxDB configured', function (done) {
      influxService._getClient(function (err) {
        try {
          err!.message.should.equal('No InfluxDB configured.');
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
      stubWriteMeasurement();

      // and it returns a Promise
      writeMeasurementStub().returns(
        new Promise<void>(function (resolve) {
          process.nextTick(resolve);
        }),
      );
    });

    it('enforces bounded network requests even when configuration asks for retries', function (done) {
      config.influxdb.options.pool = { requestTimeout: 60000, maxRetries: 10 };
      const constructor = sinon.stub(influx, 'InfluxDB').returns({});
      influxService._getClient(function (err) {
        should.not.exist(err);
        constructor.firstCall.args[0].pool.should.deepEqual({
          requestTimeout: 2000,
          maxRetries: 0,
        });
        done();
      });
    });

    context('invalid data', function () {
      it('Writing point returns error with no measurementName', function (done) {
        influxService._writeMeasurement(
          null,
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              err!.message.should.equal(
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
              err!.message.should.equal(
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
              err!.message.should.equal(
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
              err!.message.should.equal(
                'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh',
              );
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('rejects a non-string truthy measurementName', function (done) {
        influxService._writeMeasurement(
          123 as unknown as string,
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              err!.message.should.equal(
                'InfluxDB Service: no `measurementName` defined. #ghi3kH',
              );
              sinon.assert.notCalled(writeMeasurementStub());
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('logs each validation failure as an error with its message', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);

        service._writeMeasurement('m', null, {}, function () {
          service._writeMeasurement('m', {}, null, function () {
            service._writeMeasurement('m', { time: 'x' }, {}, function () {
              service._writeMeasurement(null, {}, {}, function () {
                process.env.NODE_ENV = originalEnv;
                try {
                  logger.args
                    .map(a => [a[0], a[1]])
                    .should.deepEqual([
                      [
                        'error',
                        'InfluxDB Service: no `fields` defined. #ghugGJ',
                      ],
                      ['error', 'InfluxDB Service: no `tags` defined. #ghj3ig'],
                      [
                        'error',
                        'InfluxDB Service: expected `fields.time` to be `Date` object. #f93jkh',
                      ],
                      [
                        'error',
                        'InfluxDB Service: no `measurementName` defined. #ghi3kH',
                      ],
                    ]);
                  return done();
                } catch (e) {
                  return done(e);
                }
              });
            });
          });
        });
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
                          measurementErr!.message.should.containEql(
                            'no `measurementName`',
                          );
                          fieldsErr!.message.should.containEql('no `fields`');
                          tagsErr!.message.should.containEql('no `tags`');
                          timeErr!.message.should.containEql(
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
                  fieldsErr!.message.should.containEql('no `fields`');
                  tagsErr!.message.should.containEql('no `tags`');
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
              err!.message.should.containEql('expected `fields.time`');
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
              err!.message.should.containEql('no `measurementName`');
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
              err!.message.should.containEql('no `fields`');
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
              err!.message.should.containEql('no `tags`');
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
              err!.message.should.containEql('expected `fields.time`');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });
    }); // end of context 'invalid data'

    context('valid data', function () {
      it('allows writeMeasurement success without a callback', function () {
        // A hand-rolled thenable lets us see synchronously whether the success
        // handler throws, instead of relying on an unhandled rejection.
        let thrown: unknown;
        writeMeasurementStub().returns({
          then(onFulfilled: () => void) {
            try {
              onFulfilled();
            } catch (err) {
              thrown = err;
            }
            return { catch() {} };
          },
        } as unknown as Promise<void>);

        influxService._writeMeasurement('test', { value: 1 }, { tag: 'tag' });

        sinon.assert.calledOnce(writeMeasurementStub());
        should.not.exist(thrown);
      });

      it('calls back once without an error after a successful write', function (done) {
        const callback = sinon.spy();

        influxService._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          callback,
        );

        setImmediate(function () {
          try {
            sinon.assert.calledOnce(callback);
            callback.firstCall.args.should.deepEqual([]);
            done();
          } catch (err) {
            done(err);
          }
        });
      });

      it('writes the messages namespace as messageSent and other namespaces unchanged', function (done) {
        influxService.stat(
          { namespace: 'messages', counts: { sent: 1 } },
          function () {
            influxService.stat(
              { namespace: 'other', counts: { sent: 1 } },
              function () {
                try {
                  writeMeasurementStub()
                    .args.map(a => a[0])
                    .should.deepEqual(['messageSent', 'other']);
                  done();
                } catch (err) {
                  done(err);
                }
              },
            );
          },
        );
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
            err!.message.should.equal('client fail');
            done();
          },
        );
      });

      it('propagates writeMeasurement promise rejections', function (done) {
        writeMeasurementStub().returns(
          Promise.reject(new Error('write failed')),
        );

        influxService._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            err!.message.should.equal('write failed');
            done();
          },
        );
      });

      it('calls back without throwing when no client and no error are returned', function (done) {
        sinon.stub(influxService, '_getClient').callsFake(cb => {
          cb(null);
        });

        influxService._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              should.not.exist(err);
              sinon.assert.notCalled(writeMeasurementStub());
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('does not log writeMeasurement promise rejections in test mode', function (done) {
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);
        writeMeasurementStub().returns(
          Promise.reject(new Error('write failed')),
        );

        service._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            try {
              err!.message.should.equal('write failed');
              sinon.assert.notCalled(logger);
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });

      it('logs writeMeasurement promise rejections outside test mode', function (done) {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const logger = sinon.stub();
        const service = loadInfluxServiceWithLogger(logger);
        writeMeasurementStub().returns(
          Promise.reject(new Error('write failed')),
        );

        service._writeMeasurement(
          'test',
          { value: 1 },
          { tag: 'tag' },
          function (err) {
            process.env.NODE_ENV = originalEnv;

            try {
              err!.message.should.equal('write failed');
              sinon.assert.calledOnce(logger);
              logger.firstCall.args[0].should.equal('error');
              logger.firstCall.args[1].should.equal(
                'InfluxDB Service: Error while writing to InfluxDB #fj38hh',
              );
              logger.firstCall.args[2].should.containEql({
                measurement: 'test',
                fields: { value: 1 },
                tags: { tag: 'tag' },
              });
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
