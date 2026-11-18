import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mockModule from './../../../../testutils/server/mock-module.mts';

describe('Map default location endpoint', function () {
  async function app(
    authenticated = true,
    location: object | null = { latitude: 34, longitude: -17, zoom: 6 },
  ) {
    const controller = await mockModule<
      typeof import('../../server/controllers/map-default-location.server.controller.mts')
    >(
      new URL(
        '../../server/controllers/map-default-location.server.controller.mts',
        import.meta.url,
      ),
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
    const response = await request(await app())
      .get('/api/map-default-location?ip=12.13.14.15')
      .set('X-Forwarded-For', '12.13.14.15')
      .expect(200);
    assert.deepEqual(response.body, {
      location: { latitude: 34, longitude: -17, zoom: 6 },
    });
    assert.equal(response.headers['cache-control'], 'private, no-store');
  });

  it('rejects anonymous visitors with an explanation', async function () {
    const response = await request(await app(false))
      .get('/api/map-default-location')
      .expect(401);
    assert.deepEqual(response.body, { message: 'Authentication required.' });
    assert.equal(response.headers['cache-control'], 'private, no-store');
  });
});
