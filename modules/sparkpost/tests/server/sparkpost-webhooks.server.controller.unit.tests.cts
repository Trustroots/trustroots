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

  it('rejects batches that are not a non-empty array', async () => {
    const { controller } = loadController();
    for (const body of [undefined, {}, [], 'events']) {
      const res = mockResponse();
      receiveBatch(controller, body, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      should(res.body).deepEqual({ message: 'Bad request.' });
    }
  });

  it('ignores events without a msys payload without logging or sending metrics', async () => {
    const { controller, log, stat } = loadController();

    for (const event of [{}, { msys: {} }]) {
      should.not.exist(await processEvent(controller, event));
    }

    stat.called.should.be.false();
    log.called.should.be.false();
  });

  const eventCategories = [
    'message_event',
    'relay_event',
    'track_event',
    'gen_event',
    'unsubscribe_event',
  ];
  const eventTypes = [
    'injection',
    'delivery',
    'policy_Rejection',
    'delay',
    'bounce',
    'out_of_band',
    'spam_complaint',
    'generation_failure',
    'generation_rejection',
    'policy_rejection',
    'sms_status',
    'link_unsubscribe',
    'list_unsubscribe',
    'relay_delivery',
    'relay_injection',
    'relay_rejection',
    'relay_tempfail',
    'relay_permfail',
    'open',
    'click',
  ];

  for (const category of eventCategories) {
    it(`sends metrics for the ${category} category`, async () => {
      const { controller, stat } = loadController();

      should.not.exist(
        await processEvent(controller, {
          msys: { [category]: { type: 'open' } },
        }),
      );

      stat.calledOnce.should.be.true();
      stat.firstCall.args[0].tags!.should.deepEqual({
        category,
        type: 'open',
      });
    });
  }

  for (const type of eventTypes) {
    it(`sends metrics for the ${type} type`, async () => {
      const { controller, stat } = loadController();

      should.not.exist(
        await processEvent(controller, {
          msys: { message_event: { type } },
        }),
      );

      stat.calledOnce.should.be.true();
      stat.firstCall.args[0].tags!.should.deepEqual({
        category: 'message_event',
        type,
      });
    });
  }

  it('logs the category and type of events it cannot validate', async () => {
    const { controller, log } = loadController();

    await processEvent(controller, {
      msys: { unknown_event: { type: 'unknown-type' } },
    });

    (log.firstCall.args as unknown[])
      .slice(0, 3)
      .should.eql([
        'error',
        'Could not validate SparkPost event webhook.',
        { type: 'unknown-type', category: 'unknown_event' },
      ]);
  });

  it('ignores a valid category with an unknown type and the reverse', async () => {
    const { controller, stat } = loadController();

    await processEvent(controller, {
      msys: { message_event: { type: 'unknown-type' } },
    });
    await processEvent(controller, {
      msys: { unknown_event: { type: 'open' } },
    });

    stat.called.should.be.false();
  });

  it('truncates long campaign ids at a word boundary within 255 characters', async () => {
    const { controller, stat } = loadController();

    await processEvent(controller, {
      msys: {
        message_event: { campaign_id: 'abcd '.repeat(100), type: 'delivery' },
      },
    });

    should(stat.firstCall.args[0].meta!.campaignId).equal(
      `${'abcd-'.repeat(50)}abcd`,
    );
  });

  it('leaves the campaign id empty when it is not a string', async () => {
    const { controller, stat } = loadController();

    await processEvent(controller, {
      msys: { message_event: { campaign_id: 12345, type: 'delivery' } },
    });
    await processEvent(controller, {
      msys: { message_event: { type: 'open' } },
    });

    stat.callCount.should.equal(2);
    for (const call of stat.getCalls()) {
      should(call.args[0].meta!.campaignId).equal('');
    }
  });

  it('accepts three-letter country codes but not longer ones', async () => {
    const { controller, stat } = loadController();

    for (const country of ['usa', 'usaa']) {
      await processEvent(controller, {
        msys: { message_event: { geo_ip: { country }, type: 'delivery' } },
      });
    }

    should(stat.getCall(0).args[0].meta!.country).equal('USA');
    should(stat.getCall(1).args[0].meta!.country).equal('');
  });

  it('denies webhook auth when credentials are missing', () => {
    const { controller } = loadController();
    const res = mockResponse();

    authenticate(controller, {}, res);

    res.statusCode.should.equal(401);
    res.headers['WWW-Authenticate'].should.equal('Basic realm="Knock Knock"');
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
});
