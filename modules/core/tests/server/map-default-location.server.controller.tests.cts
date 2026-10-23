const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const express: typeof import('express') = require('express');
const request: typeof import('supertest') = require('supertest');
const mockModule: typeof import('../../../../testutils/server/mock-module') = require('../../../../testutils/server/mock-module');

describe('Map default location endpoint', function () {
  function app(
    authenticated = true,
    location: object | null = { latitude: 34, longitude: -17, zoom: 6 },
  ) {
    const controller = mockModule<
      typeof import('../../server/controllers/map-default-location.server.controller.mts')
    >(
      require.resolve('../../server/controllers/map-default-location.server.controller.mts'),
      {
        '../../../../config/config.mts': { geoip: { databasePath: 'fixture' } },
        '../services/geoip.server.service.mts': {
          createGeoipLookup: (path: string) => {
            assert.equal(path, 'fixture');
            return async (ip: string) => {
              assert.equal(ip, '11.12.13.14');
              return location;
            };
          },
        },
      },
    );
    const server = express();
    server.use((req, _res, next) => {
      if (authenticated)
        Object.assign(req, { user: { _id: 'fictional-member' } });
      // Model Passenger's trusted address without trusting X-Forwarded-For.
      const get = req.get.bind(req);
      req.get = ((name: string) =>
        name === '!~Passenger-Client-Address'
          ? '11.12.13.14'
          : get(name)) as typeof req.get;
      next();
    });
    server.get('/api/map-default-location', controller.getMapDefaultLocation);
    return server;
  }

  it('returns only a private approximate viewport and ignores supplied addresses', async function () {
    const response = await request(app())
      .get('/api/map-default-location?ip=12.13.14.15')
      .set('X-Forwarded-For', '12.13.14.15')
      .expect(200);
    assert.deepEqual(response.body, {
      location: { latitude: 34, longitude: -17, zoom: 6 },
    });
    assert.equal(response.headers['cache-control'], 'private, no-store');
  });

  it('returns null when no default is available', async function () {
    const response = await request(app(true, null))
      .get('/api/map-default-location')
      .expect(200);
    assert.deepEqual(response.body, { location: null });
  });

  it('requires authentication and prevents caching of rejected requests', async function () {
    const response = await request(app(false))
      .get('/api/map-default-location')
      .expect(401);
    assert.equal(response.headers['cache-control'], 'private, no-store');
  });
});
