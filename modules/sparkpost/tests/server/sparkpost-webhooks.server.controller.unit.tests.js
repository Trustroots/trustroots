const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');
const should = require('should');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = {
    body: null,
    headers: {},
    statusCode: 200,
  };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.end = () => {
    resolveResponse(res);
    return res;
  };
  res.set = (key, value) => {
    res.headers[key] = value;
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

function authHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function loadController(options = {}) {
  const stat = sinon.stub().callsFake((statsObject, callback) => {
    callback(options.statError || null);
  });
  const log = sinon.spy();
  const config = {
    sparkpostWebhook: {
      enabled: options.enabled !== false,
      password: 'secret',
      username: 'sparkpost',
    },
  };

  const controller = proxyquire(
    '../../server/controllers/sparkpost-webhooks.server.controller',
    {
      '../../../../config/config': config,
      '../../../../config/lib/logger': log,
      '../../../stats/server/services/stats.server.service': { stat },
    },
  );

  return { controller, log, stat };
}

function processEvent(controller, event) {
  return new Promise(resolve => {
    controller.processAndSendMetrics(event, err => resolve(err));
  });
}

describe('SparkPost webhook controller unit tests', () => {
  it('rejects non-array webhook batches', async () => {
    const { controller } = loadController();
    const res = mockResponse();

    controller.receiveBatch({ body: {} }, res);
    await res.waitForResponse();

    res.statusCode.should.equal(400);
  });

  it('rejects empty webhook batches', async () => {
    const { controller } = loadController();
    const res = mockResponse();

    controller.receiveBatch({ body: [] }, res);
    await res.waitForResponse();

    res.statusCode.should.equal(400);
  });

  it('responds 200 even when metric writing reports an error', async () => {
    const { controller } = loadController();
    const res = mockResponse();
    controller.processAndSendMetrics = (event, callback) => {
      callback(new Error('metric write failed'));
    };

    controller.receiveBatch({ body: [{ msys: { message_event: {} } }] }, res);
    await res.waitForResponse();

    res.statusCode.should.equal(200);
  });

  it('ignores SparkPost validation pings without msys data', async () => {
    const { controller, stat } = loadController();

    const err = await processEvent(controller, {});

    should.not.exist(err);
    stat.called.should.be.false();
  });

  it('ignores SparkPost validation pings with empty msys data', async () => {
    const { controller, stat } = loadController();

    const err = await processEvent(controller, { msys: {} });

    should.not.exist(err);
    stat.called.should.be.false();
  });

  it('logs and ignores events with invalid category or type', async () => {
    const { controller, log, stat } = loadController();

    const err = await processEvent(controller, {
      msys: {
        unknown_event: {
          type: 'unknown-type',
        },
      },
    });

    should.not.exist(err);
    stat.called.should.be.false();
    log
      .calledWith('error', 'Could not validate SparkPost event webhook.')
      .should.be.true();
  });

  it('normalizes valid webhook metrics with campaign, country and timestamp', async () => {
    const { controller, stat } = loadController();

    const err = await processEvent(controller, {
      msys: {
        message_event: {
          campaign_id: 'My Campaign! 2026',
          geo_ip: { country: 'n$l' },
          timestamp: '1454442600',
          type: 'delivery',
        },
      },
    });

    should.not.exist(err);
    stat.calledOnce.should.be.true();
    const statsObject = stat.firstCall.args[0];
    statsObject.namespace.should.equal('transactionalEmailEvent');
    statsObject.tags.should.deepEqual({
      category: 'message_event',
      type: 'delivery',
    });
    statsObject.meta.should.deepEqual({
      campaignId: 'my-campaign-2026',
      country: 'NL',
    });
    statsObject.time.toISOString().should.equal('2016-02-02T19:50:00.000Z');
  });

  it('leaves optional metadata empty when campaign and country are invalid', async () => {
    const { controller, stat } = loadController();

    const err = await processEvent(controller, {
      msys: {
        track_event: {
          campaign_id: '',
          geo_ip: { country: 'Finland' },
          type: 'open',
        },
      },
    });

    should.not.exist(err);
    stat.calledOnce.should.be.true();
    stat.firstCall.args[0].meta.should.deepEqual({
      campaignId: '',
      country: '',
    });
    should.not.exist(stat.firstCall.args[0].time);
  });

  it('denies webhook auth when credentials are missing', () => {
    const { controller } = loadController();
    const res = mockResponse();

    controller.basicAuthenticate({ headers: {} }, res, () => {});

    res.statusCode.should.equal(401);
    res.headers['WWW-Authenticate'].should.equal('Basic realm="Knock Knock"');
  });

  it('denies webhook auth when the webhook is disabled', () => {
    const { controller } = loadController({ enabled: false });
    const res = mockResponse();

    controller.basicAuthenticate(
      {
        headers: {
          authorization: authHeader('sparkpost', 'secret'),
        },
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(401);
  });

  it('denies webhook auth when username is wrong', () => {
    const { controller } = loadController();
    const res = mockResponse();

    controller.basicAuthenticate(
      {
        headers: {
          authorization: authHeader('wrong', 'secret'),
        },
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(401);
  });

  it('denies webhook auth when password is wrong', () => {
    const { controller } = loadController();
    const res = mockResponse();

    controller.basicAuthenticate(
      {
        headers: {
          authorization: authHeader('sparkpost', 'wrong'),
        },
      },
      res,
      () => {},
    );

    res.statusCode.should.equal(401);
  });

  it('allows webhook auth with configured credentials', () => {
    const { controller } = loadController();
    const res = mockResponse();
    let nextCalled = false;

    controller.basicAuthenticate(
      {
        headers: {
          authorization: authHeader('sparkpost', 'secret'),
        },
      },
      res,
      () => {
        nextCalled = true;
      },
    );

    nextCalled.should.be.true();
    res.statusCode.should.equal(200);
  });
});
