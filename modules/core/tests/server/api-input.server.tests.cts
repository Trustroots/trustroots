const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const express: typeof import('express') = require('express');
const request: typeof import('supertest') = require('supertest');
const validateApiInput: typeof import('../../server/middleware/api-input.server.middleware.mjs').default = require('../../server/middleware/api-input.server.middleware.mjs');
type CsrfFactory = (config: {
  domain: string;
  https: boolean;
  csrfAllowedOrigins?: string[];
}) => import('express').RequestHandler;
const csrfProtection: CsrfFactory = require('../../../../config/lib/csrf-protection.mjs');
const qs: { parse(query: string): unknown } = require('qs');

describe('API input boundaries', () => {
  function app() {
    const application = express();
    application.use(express.json());
    application.use('/api', validateApiInput);
    application.all('/api/echo', (req, res) =>
      res.json({ body: req.body, query: req.query }),
    );
    return application;
  }

  it('preserves ordinary nested data, arrays and literal text', async () => {
    const body = {
      message: '<b>$5.00</b>',
      values: [null, 1, true, { label: 'A.B', tags: ['hello'] }],
    };
    const response = await request(app())
      .post('/api/echo')
      .send(body)
      .expect(200);
    assert.deepEqual(response.body.body, body);
    await request(app()).get('/api/echo?name=fictional').expect(200);
  });

  for (const key of [
    '$ne',
    'profile.name',
    '__proto__',
    'constructor',
    'prototype',
  ]) {
    it(`rejects the reserved object key ${key} at any depth`, async () => {
      const body = { nested: [{ [key]: null }] };
      await request(app()).post('/api/echo').send(body).expect(400);
      await request(app())
        .get(`/api/echo?${encodeURIComponent(key)}=value`)
        .expect(400);
    });
  }

  it('checks deeply nested objects without recursive calls', () => {
    const body: Record<string, unknown> = {};
    let value = body;
    for (let index = 0; index < 20000; index++) {
      const child: Record<string, unknown> = {};
      value.child = child;
      value = child;
    }
    let continued = false;
    const response = {
      status() {
        throw new Error('Valid input must not create an error response.');
      },
    };
    validateApiInput({ body }, response, () => {
      continued = true;
    });
    assert.equal(continued, true);
  });

  it('rejects structured query expressions before reaching a handler', async () => {
    const application = app();
    application.set('query parser', (query: string) => qs.parse(query));
    for (const query of [
      'userTo[$ne]=null',
      'filter[$where]=value',
      'filter[items][0][$regex]=value',
      'filter[profile.name]=value',
    ]) {
      await request(application)
        .get('/api/echo?' + query)
        .expect(400);
    }
    const response = await request(application)
      .get('/api/echo?filter[tags][]=fictional&filter[tags][]=sample')
      .expect(200);
    assert.deepEqual(response.body.query, {
      filter: { tags: ['fictional', 'sample'] },
    });
  });

  it('applies origin and request-field checks before state changes', async () => {
    const application = express();
    let mutations = 0;
    application.use(express.json());
    application.use(
      csrfProtection({ domain: 'trustroots.example', https: true }),
    );
    application.use('/api', validateApiInput);
    application.post('/api/update', (req, res) => {
      mutations++;
      res.sendStatus(204);
    });
    await request(application)
      .post('/api/update')
      .set('Origin', 'https://other.example')
      .set('X-Trustroots-Request', '1')
      .send({ label: 'sample' })
      .expect(403);
    await request(application)
      .post('/api/update')
      .set('Origin', 'https://trustroots.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ label: 'sample' })
      .expect(403);
    await request(application)
      .post('/api/update')
      .set('Origin', 'https://trustroots.example')
      .send({ userTo: { $ne: null } })
      .expect(400);
    await request(application)
      .post('/api/update')
      .field('label', 'sample')
      .expect(403);
    assert.equal(mutations, 0);
    await request(application)
      .post('/api/update')
      .set('Origin', 'https://trustroots.example')
      .send({ label: 'sample' })
      .expect(204);
    assert.equal(mutations, 1);
  });
});
