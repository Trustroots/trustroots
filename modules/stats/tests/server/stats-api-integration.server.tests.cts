// Testing that when we send general proper data points to stats api,
// the correct data will arrive to the InfluxDB endpoint

const should: typeof import('should') = require('should');
const influx: typeof import('influx') = require('influx');
const sinon: typeof import('sinon') = require('sinon');

type WriteMeasurementArgs = Parameters<
  typeof influx.InfluxDB.prototype.writeMeasurement
>;
type WriteMeasurementStub = import('sinon').SinonStub<
  WriteMeasurementArgs,
  ReturnType<typeof influx.InfluxDB.prototype.writeMeasurement>
>;
const statsService: typeof import('../../server/services/stats.server.service.mts').default = require('./../../server/services/stats.server.service.mts');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
let writeMeasurement: WriteMeasurementStub;

describe('Stat API integration tests', function () {
  // restoring stubs
  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  // stub the influx endpoint
  beforeEach(function () {
    // stub the influx endpoint(s)
    writeMeasurement = sinon.stub(
      influx.InfluxDB.prototype,
      'writeMeasurement',
    ) as unknown as WriteMeasurementStub;

    // and writeMeasurement returns a Promise
    writeMeasurement.returns(
      new Promise<void>(function (resolve) {
        process.nextTick(resolve);
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
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    context('valid data', function () {
      it('[count with time] correct data arrive to the endpoints', function (done) {
        // call the stat api count(namespace, number, date, callback)
        const testDate = new Date('2016-01-31 5:31:01.221');
        statsService.count('testCountWithTime', 2.6, testDate, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(writeMeasurement);
            const measurement = writeMeasurement.getCall(0).args[0];
            const points = writeMeasurement.getCall(0).args[1];
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

      it('[value with time] correct data arrive to the endpoints', function (done) {
        // call the stat api value(namespace, number, date, callback)
        const testDate = new Date('2016-01-30 5:32:01.221');
        statsService.value('testValueWithTime', -3.78, testDate, function (e) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.calledOnce(writeMeasurement);
            const measurement = writeMeasurement.getCall(0).args[0];
            const points = writeMeasurement.getCall(0).args[1];
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
            sinon.assert.callCount(writeMeasurement, 0);

            return done();
          } catch (e) {
            return done(e);
          }
        },
      );
    });
  });
});
