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
});
