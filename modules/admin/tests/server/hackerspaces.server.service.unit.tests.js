const assert = require('node:assert/strict');

describe('SpaceAPI Collector import service', () => {
  let service;
  before(async () => {
    service = await import(
      '../../server/services/hackerspaces.server.service.mjs'
    );
  });
  it('normalises valid geolocated entries and source snapshots', () => {
    const result = service.normaliseCollectorEntry(
      {
        url: 'https://example.test/spaceapi.json',
        valid: true,
        lastSeen: '2026-10-12',
        data: {
          space: 'Example Workshop',
          url: 'https://example.test',
          location: {
            lat: 51.5,
            lon: -0.1,
            address: '1 Example Road',
            city: 'London',
          },
          state: { open: true },
        },
      },
      '2026-10-12T10:00:00.000Z',
    );
    assert.equal(result.endpoint, 'https://example.test/spaceapi.json');
    assert.equal(result.valid, true);
    assert.equal(result.eligible, true);
    assert.equal(result.name, 'Example Workshop');
    assert.equal(result.latitude, 51.5);
    assert.equal(result.longitude, -0.1);
    assert.equal(result.address, '1 Example Road, London');
    assert.deepEqual(result.addressParts, [
      '1 Example Road',
      'London',
      '',
      '',
      '',
    ]);
    assert.equal(result.open, 'open');
    assert.equal(result.fetchedAt, '2026-10-12T10:00:00.000Z');
  });
  it('excludes invalid entries and out-of-range or non-numeric coordinates', () => {
    assert.equal(
      service.normaliseCollectorEntry(
        {
          url: 'https://example.test/api',
          valid: false,
          data: { space: 'Example', location: { lat: 1, lon: 2 } },
        },
        'now',
      ).eligible,
      false,
    );
    assert.equal(
      service.normaliseCollectorEntry(
        {
          url: 'https://example.test/api',
          valid: true,
          data: { space: 'Example', location: { lat: 91, lon: 2 } },
        },
        'now',
      ).eligible,
      false,
    );
    assert.equal(
      service.normaliseCollectorEntry(
        {
          url: 'https://example.test/api',
          valid: true,
          data: { space: 'Example', location: { lat: 'x', lon: 2 } },
        },
        'now',
      ).latitude,
      null,
    );
  });
  it('fetches only the fixed Collector endpoint and rejects failed or malformed responses', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => [{ url: 'https://example.test/api', valid: false }],
    });
    assert.equal((await service.fetchSpaceApiCollector(fetcher)).length, 1);
    const failed = async () => ({
      ok: false,
      status: 503,
      json: async () => [],
    });
    await assert.rejects(service.fetchSpaceApiCollector(failed), /503/);
    const malformed = async () => ({
      ok: true,
      json: async () => ({ unexpected: true }),
    });
    await assert.rejects(
      service.fetchSpaceApiCollector(malformed),
      /not a list/,
    );
    assert.equal(service.SPACEAPI_COLLECTOR_URL, 'https://api.spaceapi.io/');
  });

  it('strips URL credentials and parameters and excludes malformed links', () => {
    const normalise = (url, website) =>
      service.normaliseCollectorEntry({ url, data: { url: website } }, 'now');
    assert.equal(
      normalise(
        'https://user:password@example.test/api?token=fictional#fragment',
        'https://user:password@example.test/?key=fictional#fragment',
      ).endpoint,
      'https://example.test/api',
    );
    assert.equal(normalise('', '').website, '');
    assert.equal(normalise('', 'javascript:invalid').website, '');
    assert.equal(normalise(undefined, undefined).endpoint, '');
    assert.equal(normalise('invalid', 'invalid').endpoint, 'invalid:invalid');
    assert.equal(
      normalise('file:///example', null).endpoint,
      'invalid:file:///example',
    );
    assert.equal(
      service.normaliseCollectorEntry(undefined, 'now').eligible,
      false,
    );
  });

  it('keeps optional source details and all structured address fields', () => {
    const entry = service.normaliseCollectorEntry(
      {
        url: 'https://example.test/api',
        valid: true,
        data: {
          space: 'Example Lab',
          description: 'Shared tools',
          space_type: 'fablab',
          location: {
            lat: -90,
            lon: -180,
            address: '1 Fictional Road',
            city: 'Example City',
            state: 'Example Region',
            zip: '00000',
            country_code: 'XX',
          },
          state: { open: false },
        },
      },
      'now',
    );
    assert.equal(entry.eligible, true);
    assert.equal(entry.open, 'closed');
    assert.equal(entry.spaceType, 'fablab');
    assert.equal(entry.description, 'Shared tools');
    assert.deepEqual(entry.addressParts, [
      '1 Fictional Road',
      'Example City',
      'Example Region',
      '00000',
      'XX',
    ]);
    const country = service.normaliseCollectorEntry(
      { data: { location: { country: 'Example Country' } } },
      'now',
    );
    assert.equal(country.address, 'Example Country');
    for (const [lat, lon] of [
      [-91, 0],
      [0, 181],
      [0, -181],
      [0, 'invalid'],
      [0, 0],
    ]) {
      assert.equal(
        service.normaliseCollectorEntry(
          { valid: true, data: { location: { lat, lon } } },
          'now',
        ).eligible,
        false,
      );
    }
  });

  it('accepts supported Collector envelopes and the default fetch transport', async () => {
    const original = global.fetch;
    try {
      global.fetch = async (url, options) => {
        assert.equal(url, service.SPACEAPI_COLLECTOR_URL);
        assert.equal(options.headers.accept, 'application/json');
        assert.ok(options.signal);
        return { ok: true, json: async () => ({ spaces: [{ valid: false }] }) };
      };
      assert.equal((await service.fetchSpaceApiCollector()).length, 1);
      assert.equal(
        (
          await service.fetchSpaceApiCollector(async () => ({
            ok: true,
            json: async () => ({ data: [] }),
          }))
        ).length,
        0,
      );
      await assert.rejects(
        service.fetchSpaceApiCollector(async () => ({
          ok: true,
          json: async () => null,
        })),
        /not a list/,
      );
    } finally {
      global.fetch = original;
    }
  });

  it('retries transient failures once with a fresh timeout and returns the preview', async () => {
    for (const error of [
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
      ...[
        'UND_ERR_CONNECT_TIMEOUT',
        'ETIMEDOUT',
        'ECONNRESET',
        'EAI_AGAIN',
      ].map(code => new TypeError('fetch failed', { cause: { code } })),
    ]) {
      const signals = [];
      const entries = await service.fetchSpaceApiCollector(
        async (url, options) => {
          assert.equal(url, service.SPACEAPI_COLLECTOR_URL);
          signals.push(options.signal);
          if (signals.length === 1) throw error;
          return { ok: true, json: async () => [] };
        },
      );
      assert.deepEqual(entries, []);
      assert.equal(signals.length, 2);
      assert.notEqual(signals[0], signals[1]);
    }
  });

  it('stops after two transient failures and reports a useful error', async () => {
    for (const [error, message] of [
      [
        Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
        /timed out/,
      ],
      [
        new TypeError('fetch failed', { cause: { code: 'EAI_AGAIN' } }),
        /could not be reached/,
      ],
    ]) {
      let calls = 0;
      await assert.rejects(
        service.fetchSpaceApiCollector(async () => {
          calls += 1;
          throw error;
        }),
        message,
      );
      assert.equal(calls, 2);
    }
  });

  it('does not retry permanent transport, HTTP or response-format failures', async () => {
    for (const result of [
      new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } }),
      { ok: false, status: 503 },
      { ok: true, json: async () => ({ unexpected: true }) },
    ]) {
      let calls = 0;
      await assert.rejects(
        service.fetchSpaceApiCollector(async () => {
          calls += 1;
          if (result instanceof Error) throw result;
          return result;
        }),
      );
      assert.equal(calls, 1);
    }
  });
});

describe('SpaceAPI import preview controller', () => {
  let controller;
  const originalFetch = global.fetch;
  before(async () => {
    controller = await import(
      '../../server/controllers/admin.hackerspaces.server.controller.mjs'
    );
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  function response() {
    return {
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
  }
  it('returns a reviewable preview without signing or publishing', async () => {
    global.fetch = async () => ({ ok: true, json: async () => [] });
    const res = response();
    await controller.preview({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, []);
  });
  it('reports upstream failures and handles missing error messages', async () => {
    for (const error of [new Error('Collector unavailable'), null]) {
      global.fetch = () => Promise.reject(error);
      const res = response();
      await controller.preview({}, res);
      assert.equal(res.statusCode, 502);
      assert.equal(
        res.body.message,
        error?.message || 'Could not fetch the SpaceAPI Collector.',
      );
    }
  });
});
