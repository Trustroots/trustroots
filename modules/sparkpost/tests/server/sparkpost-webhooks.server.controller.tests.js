// test whether the daily statistics job reaches influxdb and stathat via Stats api

const should = require('should');
const path = require('path');
const influx = require('influx');
const sinon = require('sinon');
const config = require(path.resolve('./config/config'));
const sparkpostWebhooks = require(path.resolve(
  './modules/sparkpost/server/controllers/sparkpost-webhooks.server.controller',
));

describe('Sparkpost Webhooks - Integration Test', function () {
  // restoring the stubs
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
  });

  const testEvent = {
    msys: {
      message_event: {
        type: 'click',
        geo_ip: {
          country: 'abc',
        },
        timestamp: 1234567890,
        campaign_id: 'this is a campaign id',
      },
    },
  };

  context('influxdb configured', function () {
    beforeEach(function () {
      // stub enable stathat in config
      sinon.stub(config.stathat, 'enabled').value(false);

      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('should reach the influxdb with data in correct format', function (done) {
      sparkpostWebhooks.processAndSendMetrics(testEvent, function (e) {
        if (e) return done(e);

        try {
          // test influx endpoint
          sinon.assert.callCount(influx.InfluxDB.prototype.writeMeasurement, 1);

          const measurement = influx.InfluxDB.prototype.writeMeasurement.getCall(
            0,
          ).args[0];
          const points = influx.InfluxDB.prototype.writeMeasurement.getCall(0)
            .args[1];
          should(points.length).eql(1);
          const point = points[0];

          should(measurement).eql('transactionalEmailEvent');
          should(point).have.propertyByPath('fields', 'count').eql(1);
          should(point).have.propertyByPath('fields', 'country').eql('ABC');
          should(point)
            .have.propertyByPath('fields', 'campaignId')
            .eql('this-is-a-campaign-id');
          should(point)
            .have.propertyByPath('tags', 'category')
            .eql('message_event');
          should(point).have.propertyByPath('tags', 'type').eql('click');

          should(point).have.property('timestamp', new Date(1234567890000));

          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
});
