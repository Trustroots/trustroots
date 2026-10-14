// test whether the daily statistics job reaches influxdb via Stats api

import type { NextFunction, Request, Response } from 'express';
import type { SinonStub } from 'sinon';

const should: typeof import('should') = require('should');
const influx: typeof import('influx') = require('influx');
const sinon: typeof import('sinon') = require('sinon');
const config: typeof import('../../../../config/config.mjs').default = require('./../../../../config/config.mjs');
const sparkpostWebhooks: typeof import('../../server/controllers/sparkpost-webhooks.server.controller.mts').default = require('./../../server/controllers/sparkpost-webhooks.server.controller.mts');

interface SparkpostEvent {
  msys?: Record<string, Record<string, unknown>>;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown> | unknown[];
  ended: boolean;
  set(key: string, value: string): MockResponse;
  status(code: number): MockResponse;
  send(body: Record<string, unknown> | unknown[]): MockResponse;
  end(): MockResponse;
}

interface SuccessfulBatchResponse {
  statusCode: number;
  status(code: number): SuccessfulBatchResponse;
  end(): void;
}

function receiveBatch(
  body: unknown,
  response: MockResponse | SuccessfulBatchResponse,
): void {
  sparkpostWebhooks.receiveBatch(
    { body } as unknown as Request,
    response as unknown as Response,
  );
}

function basicAuthenticate(
  headers: Request['headers'],
  response: MockResponse,
  next: NextFunction,
): void {
  sparkpostWebhooks.basicAuthenticate(
    { headers } as Request,
    response as unknown as Response,
    next,
  );
}

describe('Sparkpost Webhooks - Integration Test', function () {
  let writeMeasurementStub: SinonStub;

  // restoring the stubs
  afterEach(function () {
    // restore the stubbed services
    sinon.restore();
  });

  // stub the influx endpoint
  beforeEach(function () {
    // stub the influx endpoint(s)
    writeMeasurementStub = sinon.stub(
      influx.InfluxDB.prototype,
      'writeMeasurement',
    );

    // and writeMeasurement returns a Promise
    writeMeasurementStub.returns(
      new Promise<void>((resolve: () => void) =>
        process.nextTick(resolve() as unknown as () => void),
      ),
    );

    // provide config options for influxdb
    sinon.stub(config.influxdb, 'options').value({
      host: 'localhost',
      port: 8086,
      protocol: 'http',
      database: 'trustroots-test',
    });
  });

  const testEvent: SparkpostEvent = {
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

  function createResponse(): MockResponse {
    return {
      statusCode: 200,
      headers: {},
      body: {},
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
        return this;
      },
    };
  }

  function basicAuthHeader(username: string, password: string) {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  context('influxdb configured', function () {
    beforeEach(function () {
      // stub enable influx in config
      sinon.stub(config.influxdb, 'enabled').value(true);
    });

    it('receiveBatch rejects non-array payloads', function () {
      const res = createResponse();

      receiveBatch({}, res);
      res.statusCode.should.equal(400);
    });

    it('receiveBatch rejects empty batches', function () {
      const res = createResponse();

      receiveBatch([], res);
      res.statusCode.should.equal(400);
      res.body.should.have.property('message');
    });

    it('receiveBatch accepts a valid batch', function (done) {
      const processStub = sinon
        .stub(sparkpostWebhooks, 'processAndSendMetrics')
        .callsFake(
          (_event: SparkpostEvent, callback: (error?: Error | null) => void) =>
            callback(),
        );
      const res = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        end() {
          processStub.restore();
          res.statusCode.should.equal(200);
          done();
        },
      };

      receiveBatch([testEvent], res);
    });

    it('processAndSendMetrics skips empty msys payloads', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        { msys: {} },
        function (err: Error | null | undefined) {
          should.not.exist(err);
          sinon.assert.notCalled(writeMeasurementStub);
          done();
        },
      );
    });

    it('processAndSendMetrics skips events without msys payloads', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        {},
        function (err: Error | null | undefined) {
          should.not.exist(err);
          sinon.assert.notCalled(writeMeasurementStub);
          done();
        },
      );
    });

    it('processAndSendMetrics skips invalid event categories', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        { msys: { unknown: { type: 'click' } } },
        function (err: Error | null | undefined) {
          should.not.exist(err);
          sinon.assert.notCalled(writeMeasurementStub);
          done();
        },
      );
    });

    it('processAndSendMetrics skips invalid event types', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        { msys: { message_event: { type: 'unknown' } } },
        function (err: Error | null | undefined) {
          should.not.exist(err);
          sinon.assert.notCalled(writeMeasurementStub);
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
        function (e: Error | null | undefined) {
          if (e) return done(e);

          try {
            sinon.assert.callCount(writeMeasurementStub, 1);

            const point = writeMeasurementStub.getCall(0).args[1][0];

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

      basicAuthenticate({}, res, () => {
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

      basicAuthenticate(req.headers, res, () => {
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

      basicAuthenticate(req.headers, res, () => {
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

      basicAuthenticate(req.headers, res, () => {
        nextCalled = true;
      });

      nextCalled.should.be.true();
      res.statusCode.should.equal(200);
      config.sparkpostWebhook.enabled = originalEnabled;
    });

    it('should reach the influxdb with data in correct format', function (done) {
      sparkpostWebhooks.processAndSendMetrics(
        testEvent,
        function (e: Error | null | undefined) {
          if (e) return done(e);

          try {
            // test influx endpoint
            sinon.assert.callCount(writeMeasurementStub, 1);

            const measurement = writeMeasurementStub.getCall(0).args[0];
            const points = writeMeasurementStub.getCall(0).args[1];
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
        },
      );
    });
  });
});
