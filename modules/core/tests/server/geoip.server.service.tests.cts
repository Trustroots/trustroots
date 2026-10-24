import type { CityResponse } from 'maxmind';
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const geoip: typeof import('../../server/services/geoip.server.service.mts') = require('../../server/services/geoip.server.service.mts');
const mockModule: typeof import('../../../../testutils/server/mock-module') = require('../../../../testutils/server/mock-module');

function record(
  latitude = 34.4,
  longitude = -17.3,
  accuracy_radius = 30,
): CityResponse {
  return { location: { latitude, longitude, accuracy_radius } } as CityResponse;
}

describe('Approximate map location lookup', function () {
  it('rounds coordinates, accepts zero and widens uncertain or polar locations', function () {
    assert.deepEqual(geoip.approximateViewport(record()), {
      latitude: 34,
      longitude: -17,
      zoom: 6,
    });
    assert.deepEqual(geoip.approximateViewport(record(0, 0)), {
      latitude: 0,
      longitude: 0,
      zoom: 6,
    });
    assert.equal(geoip.approximateViewport(record(0, 0, 1000))!.zoom, 4);
    assert.equal(geoip.approximateViewport(record(90, 180, 20000))!.zoom, 0);
    assert.equal(geoip.approximateViewport(record(-90, -180))!.latitude, -85);
  });

  it('ignores absent, invalid and incomplete lookup data', function () {
    for (const value of [
      null,
      {},
      { location: {} },
      record(NaN),
      record(0, NaN),
      record(0, 0, NaN),
      record(91),
      record(0, 181),
      record(0, 0, 0),
      record(0, 0, -1),
      record(0, 0, 20041),
    ]) {
      assert.equal(
        geoip.approximateViewport(value as CityResponse | null),
        null,
      );
    }
  });

  it('does not open a disabled database or retry an unavailable one per request', async function () {
    let opens = 0;
    const open = async () => {
      opens++;
      throw new Error('unavailable');
    };
    const disabled = geoip.createGeoipLookup('', open);
    assert.equal(await disabled('11.12.13.14'), null);
    assert.equal(opens, 0);
    const missing = geoip.createGeoipLookup('/fictional/db.mmdb', open);
    assert.deepEqual(
      await Promise.all([missing('11.12.13.14'), missing('12.13.14.15')]),
      [null, null],
    );
    assert.equal(opens, 1);
  });

  it('rejects invalid and non-public IPv4, IPv6 and mapped addresses before lookup', async function () {
    let queries = 0;
    const lookup = geoip.createGeoipLookup('db', async () => ({
      get: () => {
        queries++;
        return record();
      },
    }));
    for (const ip of [
      undefined,
      '',
      'not-an-ip',
      '127.0.0.1',
      '10.2.3.4',
      '172.16.2.3',
      '192.168.2.3',
      '169.254.2.3',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '192.0.2.4',
      '::1',
      '::',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '2001:db8::1',
    ]) {
      assert.equal(await lookup(ip), null, String(ip));
    }
    assert.equal(queries, 0);
  });

  it('opens once and isolates concurrent IPv4/IPv6 requests and mapped public addresses', async function () {
    let opens = 0;
    const addresses: string[] = [];
    const lookup = geoip.createGeoipLookup('db', async () => {
      opens++;
      return {
        get: (ip: string) => {
          addresses.push(ip);
          return record(ip.includes(':') ? 12 : 34);
        },
      };
    });
    const [ipv4, ipv6, mapped] = await Promise.all([
      lookup('11.12.13.14'),
      lookup('2606:4700::1234'),
      lookup('::ffff:12.13.14.15'),
    ]);
    assert.equal(opens, 1);
    assert.equal(ipv4!.latitude, 34);
    assert.equal(ipv6!.latitude, 12);
    assert.equal(mapped!.latitude, 34);
    assert.deepEqual(addresses, [
      '11.12.13.14',
      '2606:4700::1234',
      '12.13.14.15',
    ]);
  });

  it('returns null when records are missing or the reader throws', async function () {
    const absent = geoip.createGeoipLookup('db', async () => ({
      get: () => null,
    }));
    const broken = geoip.createGeoipLookup('db', async () => ({
      get: () => {
        throw new Error('broken');
      },
    }));
    assert.equal(await absent('11.12.13.14'), null);
    assert.equal(await broken('11.12.13.14'), null);
  });

  it('opens the default MMDB reader with a bounded cache', async function () {
    let options: unknown;
    const isolated = mockModule<typeof geoip>(
      require.resolve('../../server/services/geoip.server.service.mts'),
      {
        maxmind: {
          open: async (path: string, opts: unknown) => {
            assert.equal(path, '/fictional/db.mmdb');
            options = opts;
            return { get: () => record() };
          },
        },
      },
    );
    assert.equal(
      (await isolated.createGeoipLookup('/fictional/db.mmdb')('11.12.13.14'))!
        .latitude,
      34,
    );
    assert.deepEqual(options, { cache: { max: 1000 } });
  });
});
