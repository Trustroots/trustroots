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

  function createResponse() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      ended: false,
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
      end() {
        this.ended = true;
      },
    };
  }

  function basicAuthHeader(username, password) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  context('influxdb configured', function () {
    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('receiveBatch rejects non-array payloads', function () {
      const res = createResponse();

      sparkpostWebhooks.receiveBatch({ body: {} }, res);
      res.statusCode.should.equal(400);
    });

    it('receiveBatch rejects empty batches', function () {
      const res = createResponse();

      sparkpostWebhooks.receiveBatch({ body: [] }, res);
      res.statusCode.should.equal(400);
      res.body.should.have.property('message');
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

    it('processAndSendMetrics skips events without msys payloads', function (done) {
      sparkpostWebhooks.processAndSendMetrics({}, function (err) {
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

    it('processAndSendMetrics skips invalid event types', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        { msys: { message_event: { type: 'unknown' } } },
        function (err) {
          should.not.exist(err);
          sinon.assert.notCalled(influx.InfluxDB.prototype.writeMeasurement);
          done();
        },
      );
    });

    it('processAndSendMetrics omits invalid optional metadata', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        {
          msys: {
            track_event: {
              type: 'open',
              campaign_id: 42,
              geo_ip: {
                country: 'earth',
              },
            },
          },
        },
        function (e) {
          if (e) return done(e);

          try {
            sinon.assert.callCount(
              influx.InfluxDB.prototype.writeMeasurement,
              1,
            );

            const point =
              influx.InfluxDB.prototype.writeMeasurement.getCall(0).args[1][0];

            should(point).have.propertyByPath('fields', 'country').eql('');
            should(point).have.propertyByPath('fields', 'campaignId').eql('');
            should(point).not.have.property('timestamp');
            should(point)
              .have.propertyByPath('tags', 'category')
              .eql('track_event');
            should(point).have.propertyByPath('tags', 'type').eql('open');

            return done();
          } catch (err) {
            return done(err);
          }
        },
      );
    });

    it('basicAuthenticate rejects missing credentials', function () {
      const originalEnabled = config.sparkpostWebhook.enabled;
      config.sparkpostWebhook.enabled = true;
      const res = createResponse();
      let nextCalled = false;

      sparkpostWebhooks.basicAuthenticate({ headers: {} }, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.false();
      res.statusCode.should.equal(401);
      config.sparkpostWebhook.enabled = originalEnabled;
    });

    it('basicAuthenticate rejects valid credentials when webhook auth is disabled', function () {
      const originalEnabled = config.sparkpostWebhook.enabled;
      config.sparkpostWebhook.enabled = false;
      const res = createResponse();
      let nextCalled = false;
      const req = {
        headers: {
          authorization: basicAuthHeader(
            config.sparkpostWebhook.username,
            config.sparkpostWebhook.password,
          ),
        },
      };

      sparkpostWebhooks.basicAuthenticate(req, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.false();
      res.statusCode.should.equal(401);
      res.headers.should.have.property(
        'WWW-Authenticate',
        'Basic realm="Knock Knock"',
      );
      config.sparkpostWebhook.enabled = originalEnabled;
    });

    it('basicAuthenticate rejects incorrect passwords', function () {
      const originalEnabled = config.sparkpostWebhook.enabled;
      config.sparkpostWebhook.enabled = true;
      const res = createResponse();
      let nextCalled = false;
      const req = {
        headers: {
          authorization: basicAuthHeader(
            config.sparkpostWebhook.username,
            'incorrect-password',
          ),
        },
      };

      sparkpostWebhooks.basicAuthenticate(req, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.false();
      res.statusCode.should.equal(401);
      config.sparkpostWebhook.enabled = originalEnabled;
    });

    it('basicAuthenticate accepts matching credentials when webhook auth is enabled', function () {
      const originalEnabled = config.sparkpostWebhook.enabled;
      config.sparkpostWebhook.enabled = true;
      const res = createResponse();
      let nextCalled = false;
      const req = {
        headers: {
          authorization: basicAuthHeader(
            config.sparkpostWebhook.username,
            config.sparkpostWebhook.password,
          ),
        },
      };

      sparkpostWebhooks.basicAuthenticate(req, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.true();
      res.statusCode.should.equal(200);
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
