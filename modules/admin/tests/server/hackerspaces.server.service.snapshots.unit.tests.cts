const assert: typeof import('node:assert').strict =
  require('node:assert').strict;

type SpaceApiService =
  typeof import('../../server/services/hackerspaces.server.service.mts');

describe('SpaceAPI Collector snapshots', () => {
  let service: SpaceApiService;
  before(async () => {
    service =
      await import('../../server/services/hackerspaces.server.service.mts');
  });

  const located = (lat: unknown, lon: unknown) =>
    service.normaliseCollectorEntry(
      { valid: true, data: { space: 'Example', location: { lat, lon } } },
      'now',
    );

  it('keeps http and https links without credentials, parameters or fragments', () => {
    for (const [input, expected] of [
      ['http://example.test/api', 'http://example.test/api'],
      [
        'https://user:password@example.test/path?key=fictional#fragment',
        'https://example.test/path',
      ],
    ]) {
      const entry = service.normaliseCollectorEntry(
        { url: input, data: { url: input } },
        'now',
      );
      assert.equal(entry.endpoint, expected);
      assert.equal(entry.website, expected);
    }
  });

  it('drops websites that are not strings', () => {
    for (const website of [undefined, ['https://example.test/'], 42]) {
      assert.equal(
        service.normaliseCollectorEntry({ data: { url: website } }, 'now')
          .website,
        '',
      );
    }
  });

  it('truncates long invalid endpoints to 256 characters', () => {
    const unsupported = `ftp://example.test/${'a'.repeat(300)}`;
    assert.equal(
      service.normaliseCollectorEntry({ url: unsupported }, 'now').endpoint,
      `invalid:${unsupported.slice(0, 256)}`,
    );
    const unparseable = `not a url ${'b'.repeat(300)}`;
    assert.equal(
      service.normaliseCollectorEntry({ url: unparseable }, 'now').endpoint,
      `invalid:${unparseable.slice(0, 256)}`,
    );
  });

  it('accepts coordinates on the range boundaries and rejects them just beyond', () => {
    for (const [lat, lon] of [
      [-90, 1],
      [90, 1],
      [1, -180],
      [1, 180],
    ]) {
      const entry = located(lat, lon);
      assert.equal(entry.eligible, true, `${lat},${lon}`);
      assert.equal(entry.latitude, lat);
      assert.equal(entry.longitude, lon);
    }
    for (const [lat, lon] of [
      [-90.5, 1],
      [90.5, 1],
      [1, -180.5],
      [1, 180.5],
    ]) {
      assert.equal(located(lat, lon).eligible, false, `${lat},${lon}`);
    }
  });

  it('returns the last-seen date when present and null otherwise', () => {
    assert.equal(
      service.normaliseCollectorEntry({ lastSeen: 1760000000 }, 'now').lastSeen,
      1760000000,
    );
    assert.equal(service.normaliseCollectorEntry({}, 'now').lastSeen, null);
  });

  it('fills defaults for missing source details', () => {
    const entry = service.normaliseCollectorEntry(
      { data: { location: { country: 'Example Country' } } },
      'now',
    );
    assert.equal(entry.name, '');
    assert.equal(entry.description, '');
    assert.equal(entry.open, '');
    assert.equal(entry.spaceType, 'hackerspace');
    assert.deepEqual(entry.addressParts, ['', '', '', '', 'Example Country']);
  });

  it('joins every address part and ignores non-boolean open states', () => {
    const entry = service.normaliseCollectorEntry(
      {
        data: {
          location: {
            address: '1 Fictional Road',
            city: 'Example City',
            state: 'Example Region',
            zip: '00000',
            country_code: 'XX',
          },
          state: { open: 'yes' },
        },
      },
      'now',
    );
    assert.equal(
      entry.address,
      '1 Fictional Road, Example City, Example Region, 00000, XX',
    );
    assert.equal(entry.open, '');
  });

  it('normalises every fetched entry', async () => {
    const entries = await service.fetchSpaceApiCollector(async () => ({
      ok: true,
      json: async () => [
        { url: 'https://example.test/one', data: { space: 'One' } },
      ],
    }));
    assert.equal(entries.length, 1);
    assert.equal(entries[0].endpoint, 'https://example.test/one');
    assert.equal(entries[0].name, 'One');
  });

  it('keeps the transport failure as the cause after the retry fails', async () => {
    const failure = new TypeError('fetch failed', {
      cause: { code: 'ECONNRESET' },
    });
    await assert.rejects(
      service.fetchSpaceApiCollector(async () => {
        throw failure;
      }),
      (error: Error) => {
        assert.equal(error.cause, failure);
        return true;
      },
    );
  });
});
