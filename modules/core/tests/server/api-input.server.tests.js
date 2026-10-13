const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const validateApiInput = require('../../server/middleware/api-input.server.middleware.mjs');

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
    const body = {};
    let value = body;
    for (let index = 0; index < 20000; index++) {
      value.child = {};
      value = value.child;
    }
    let continued = false;
    validateApiInput({ body }, {}, () => {
      continued = true;
    });
    assert.equal(continued, true);
  });
});
