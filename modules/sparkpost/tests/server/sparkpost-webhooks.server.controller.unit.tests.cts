type WebhookEvent = { msys?: Record<string, Record<string, unknown>> };
type StatPoint =
  import('../../../stats/server/services/stats.server.service.mts').StatObject;
type WebhookController =
  typeof import('../../server/controllers/sparkpost-webhooks.server.controller.mts').default;
type MockResponse = {
  body: unknown;
  headers: Record<string, string>;
  statusCode: number;
  status(code: number): MockResponse;
  send(body?: unknown): MockResponse;
  end(): MockResponse;
  set(key: string, value: string): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};
type WebhookConfig = typeof import('../../../../config/config.mts').default & {
  sparkpostWebhook: { enabled: boolean; username: string; password: string };
};
const config: WebhookConfig = require('./../../../../config/config.mts');
const winston: typeof import('winston') = require('winston');
const statService: typeof import('../../../stats/server/services/stats.server.service.mts').default = require('./../../../stats/server/services/stats.server.service.mts');
const controller: WebhookController = require('./../../server/controllers/sparkpost-webhooks.server.controller.mts');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
void should;

function mockResponse(): MockResponse {
  let resolveResponse!: (response: MockResponse) => void;
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    body: null,
    headers: {},
    statusCode: 200,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    end() {
      resolveResponse(res);
      return res;
    },
    set(key, value) {
      res.headers[key] = value;
      return res;
    },
    waitForResponse: () => promise,
  };
  return res;
}

function authHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function receiveBatch(
  webhookController: WebhookController,
  body: unknown,
  res: MockResponse,
) {
  webhookController.receiveBatch(
    { body } as unknown as Parameters<typeof webhookController.receiveBatch>[0],
    res as unknown as Parameters<typeof webhookController.receiveBatch>[1],
  );
}

function authenticate(
  webhookController: WebhookController,
  headers: Record<string, string>,
  res: MockResponse,
  next: () => void = () => {},
) {
  webhookController.basicAuthenticate(
    { headers } as unknown as Parameters<
      typeof webhookController.basicAuthenticate
    >[0],
    res as unknown as Parameters<typeof webhookController.basicAuthenticate>[1],
    next,
  );
}

function loadController(
  options: { statError?: Error; enabled?: boolean } = {},
) {
  const stat = sinon.stub(
    statService,
    'stat',
  ) as unknown as import('sinon').SinonStub<
    [point: StatPoint, callback: (error?: Error | null) => void],
    void
  >;
  stat.callsFake((_statsObject, callback) => {
    callback(options.statError || null);
  });
  const log = sinon.stub(winston.Logger.prototype, 'log');
  sinon.stub(config, 'sparkpostWebhook').value({
    enabled: options.enabled !== false,
    password: 'secret',
    username: 'sparkpost',
  });

  return { controller, log, stat };
}

function processEvent(controller: WebhookController, event: WebhookEvent) {
  return new Promise<Error | null | undefined>(resolve => {
    controller.processAndSendMetrics(event, err => resolve(err));
  });
}

describe('SparkPost webhook controller unit tests', () => {
  afterEach(() => sinon.restore());

  function stubPreferenceUpdate(error?: Error) {
    const exec = sinon.stub();
    if (error) exec.rejects(error);
    else exec.resolves({ matchedCount: 1, modifiedCount: 1 });
    const updateOne = sinon.stub().returns({ exec });
    sinon.stub(mongoose, 'model').returns({
      updateOne,
    } as unknown as ReturnType<typeof mongoose.model>);
    return { updateOne, exec };
  }

  for (const type of ['list_unsubscribe', 'link_unsubscribe']) {
    it(`persists ${type} opt-outs before acknowledging a batch`, async () => {
      const { controller, stat } = loadController();
      const { updateOne, exec } = stubPreferenceUpdate();
      let finish!: () => void;
      exec.returns(new Promise<void>(resolve => (finish = resolve)));
      const res = mockResponse();

      receiveBatch(
        controller,
        [
          {
            msys: {
              unsubscribe_event: {
                type,
                rcpt_to: ' MEMBER@example.test ',
              },
            },
          },
        ],
        res,
      );

      stat.called.should.be.false();
      finish();
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      sinon.assert.calledWithExactly(
        updateOne,
        { email: 'member@example.test', newsletter: true },
        { $set: { newsletter: false } },
      );
      stat.calledOnce.should.be.true();
    });
  }

  it('ignores malformed recipients and unrelated events without querying users', async () => {
    const { controller } = loadController();
    const { updateOne } = stubPreferenceUpdate();
    const events: WebhookEvent[] = [
      {},
      { msys: {} },
      {
        msys: {
          message_event: {
            type: 'list_unsubscribe',
            rcpt_to: 'member@example.test',
          },
        },
      },
      {
        msys: {
          unsubscribe_event: {
            type: 'delivery',
            rcpt_to: 'member@example.test',
          },
        },
      },
      ...[undefined, null, '', ' ', 'invalid', 42, { $ne: null }].map(
        rcpt_to => ({
          msys: { unsubscribe_event: { type: 'list_unsubscribe', rcpt_to } },
        }),
      ),
    ];
    for (const event of events) {
      await new Promise<void>(resolve =>
        controller.processUnsubscribe(event, () => resolve()),
      );
    }
    sinon.assert.notCalled(updateOne);
  });

  it('returns a retryable response when an opt-out cannot be persisted', async () => {
    const { controller, stat } = loadController();
    stubPreferenceUpdate(new Error('database unavailable'));
    const res = mockResponse();

    receiveBatch(
      controller,
      [
        {
          msys: {
            unsubscribe_event: {
              type: 'list_unsubscribe',
              rcpt_to: 'member@example.test',
            },
          },
        },
      ],
      res,
    );
    await res.waitForResponse();

    res.statusCode.should.equal(503);
    should(res.body).deepEqual({
      message: 'Could not process SparkPost unsubscribe events.',
    });
    stat.called.should.be.false();
  });

  it('keeps a persisted opt-out when metrics fail', async () => {
    const { controller } = loadController({
      statError: new Error('metrics unavailable'),
    });
    const { updateOne } = stubPreferenceUpdate();
    const res = mockResponse();
    receiveBatch(
      controller,
      [
        {
          msys: {
            unsubscribe_event: {
              type: 'link_unsubscribe',
              rcpt_to: 'member@example.test',
            },
          },
        },
      ],
      res,
    );
    await res.waitForResponse();
    res.statusCode.should.equal(200);
    updateOne.calledOnce.should.be.true();
  });
  it('rejects non-array webhook batches', async () => {
    const { controller } = loadController();
    const res = mockResponse();

    receiveBatch(controller, {}, res);
    await res.waitForResponse();

    res.statusCode.should.equal(400);
  });

  it('rejects empty webhook batches', async () => {
    const { controller } = loadController();
    const res = mockResponse();

    receiveBatch(controller, [], res);
    await res.waitForResponse();

    res.statusCode.should.equal(400);
  });

  it('responds 200 even when metric writing reports an error', async () => {
    const { controller } = loadController();
    const res = mockResponse();
    sinon
      .stub(controller, 'processAndSendMetrics')
      .callsFake((event, callback) => {
        callback(new Error('metric write failed'));
      });

    receiveBatch(controller, [{ msys: { message_event: {} } }], res);
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
    statsObject.tags!.should.deepEqual({
      category: 'message_event',
      type: 'delivery',
    });
    statsObject.meta!.should.deepEqual({
      campaignId: 'my-campaign-2026',
      country: 'NL',
    });
    statsObject.time!.toISOString().should.equal('2016-02-02T19:50:00.000Z');
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
    stat.firstCall.args[0].meta!.should.deepEqual({
      campaignId: '',
      country: '',
    });
    should.not.exist(stat.firstCall.args[0].time);
  });

  it('denies webhook auth when credentials are missing', () => {
    const { controller } = loadController();
    const res = mockResponse();

    authenticate(controller, {}, res);

    res.statusCode.should.equal(401);
    res.headers['WWW-Authenticate'].should.equal('Basic realm="Knock Knock"');
  });

  it('denies webhook auth when the webhook is disabled', () => {
    const { controller } = loadController({ enabled: false });
    const res = mockResponse();

    authenticate(
      controller,
      { authorization: authHeader('sparkpost', 'secret') },
      res,
    );

    res.statusCode.should.equal(401);
  });

  it('denies webhook auth when username is wrong', () => {
    const { controller } = loadController();
    const res = mockResponse();

    authenticate(
      controller,
      { authorization: authHeader('wrong', 'secret') },
      res,
    );

    res.statusCode.should.equal(401);
  });

  it('denies webhook auth when password is wrong', () => {
    const { controller } = loadController();
    const res = mockResponse();

    authenticate(
      controller,
      { authorization: authHeader('sparkpost', 'wrong') },
      res,
    );

    res.statusCode.should.equal(401);
  });

  it('allows webhook auth with configured credentials', () => {
    const { controller } = loadController();
    const res = mockResponse();
    let nextCalled = false;

    authenticate(
      controller,
      { authorization: authHeader('sparkpost', 'secret') },
      res,
      () => {
        nextCalled = true;
      },
    );

    nextCalled.should.be.true();
    res.statusCode.should.equal(200);
  });
});
