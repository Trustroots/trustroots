// test whether the daily statistics job reaches influxdb via Stats api

const should = require('should');
const influx = require('influx');
const sinon = require('sinon');
const config = require('../../../../config/config');
const sparkpostWebhooks = require('../../server/controllers/sparkpost-webhooks.server.controller');

describe('Sparkpost Webhooks - Integration Test', function () {
  // restoring the stubs
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
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('receiveBatch rejects non-array payloads', function () {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        send(body) {
          this.body = body;
          return this;
        },
        end() {},
      };

      sparkpostWebhooks.receiveBatch({ body: {} }, res);
      res.statusCode.should.equal(400);
    });

    it('receiveBatch accepts a valid batch', function (done) {
      const processStub = sinon
        .stub(sparkpostWebhooks, 'processAndSendMetrics')
        .callsFake((event, cb) => cb());
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        end() {
          processStub.restore();
          res.statusCode.should.equal(200);
          done();
        },
      };

      sparkpostWebhooks.receiveBatch({ body: [testEvent] }, res);
    });

    it('processAndSendMetrics skips empty msys payloads', function (done) {
      sparkpostWebhooks.processAndSendMetrics({ msys: {} }, function (err) {
        should.not.exist(err);
        sinon.assert.notCalled(influx.InfluxDB.prototype.writeMeasurement);
        done();
      });
    });

    it('processAndSendMetrics skips invalid event categories', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        { msys: { unknown: { type: 'click' } } },
        function (err) {
          should.not.exist(err);
          sinon.assert.notCalled(influx.InfluxDB.prototype.writeMeasurement);
          done();
        },
      );
    });

    it('basicAuthenticate rejects missing credentials', function () {
      const originalEnabled = config.sparkpostWebhook.enabled;
      config.sparkpostWebhook.enabled = true;
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        set(key, value) {
          this.headers[key] = value;
          return this;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        send(body) {
          this.body = body;
          return this;
        },
      };
      let nextCalled = false;

      sparkpostWebhooks.basicAuthenticate({ headers: {} }, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.false();
      res.statusCode.should.equal(401);
      config.sparkpostWebhook.enabled = originalEnabled;
    });

    it('should reach the influxdb with data in correct format', function (done) {
      sparkpostWebhooks.processAndSendMetrics(testEvent, function (e) {
        if (e) return done(e);

        try {
          // test influx endpoint
          sinon.assert.callCount(influx.InfluxDB.prototype.writeMeasurement, 1);

          const measurement =
            influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[0];
          const points =
            influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1];
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
