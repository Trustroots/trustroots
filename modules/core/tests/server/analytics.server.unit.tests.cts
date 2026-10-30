const assert: typeof import('node:assert/strict') = require('assert/strict');
type ServerAnalyticsApi = typeof import('@trustroots/analytics/server');
const {
  createServerAnalytics,
  requestsNoTracking,
}: ServerAnalyticsApi = require('@trustroots/analytics/server');

type SentRequest = { url: string; init: RequestInit };

const options = {
  hostUrl: 'https://analytics.example.org',
  websiteId: '00000000-0000-4000-8000-000000000000',
  hostname: 'www.example.org',
};

describe('@trustroots/analytics/server', function () {
  const originalFetch = global.fetch;
  let sent: SentRequest[];

  beforeEach(function () {
    sent = [];
    global.fetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response('{}');
    }) as typeof global.fetch;
  });

  afterEach(function () {
    global.fetch = originalFetch;
  });

  it('sends events with and without data to the Umami send endpoint', async function () {
    const analytics = createServerAnalytics(options);

    await analytics.track({}, 'offer-delete', { type: 'meet' });
    await analytics.track({ dnt: '0' }, 'signin-success');

    assert.equal(sent.length, 2);
    assert.equal(sent[0].url, 'https://analytics.example.org/api/send');
    assert.equal(sent[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(sent[0].init.body)), {
      type: 'event',
      payload: {
        website: options.websiteId,
        hostname: options.hostname,
        name: 'offer-delete',
        data: { type: 'meet' },
      },
    });
    assert.deepEqual(JSON.parse(String(sent[1].init.body)).payload, {
      website: options.websiteId,
      hostname: options.hostname,
      name: 'signin-success',
    });
  });

  it('sends nothing when analytics is disabled', async function () {
    const analytics = createServerAnalytics({ ...options, enabled: false });

    await analytics.track({}, 'signin-success');

    assert.equal(sent.length, 0);
  });

  it('respects Do-Not-Track and Global Privacy Control', async function () {
    const analytics = createServerAnalytics({ ...options, enabled: true });

    await analytics.track({ dnt: '1' }, 'signin-success');
    await analytics.track({ 'sec-gpc': ['1'] }, 'signin-success');

    assert.equal(sent.length, 0);
    assert.equal(requestsNoTracking({ dnt: ' 1 ' }), true);
    assert.equal(requestsNoTracking({ dnt: [] }), false);
    assert.equal(requestsNoTracking({ 'sec-gpc': '0' }), false);
  });

  it('never rejects when delivery fails', async function () {
    global.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof global.fetch;
    const analytics = createServerAnalytics(options);

    await assert.doesNotReject(analytics.track({}, 'signin-failure'));
  });
});
