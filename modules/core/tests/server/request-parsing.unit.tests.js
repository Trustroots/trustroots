const express = require('express');
const request = require('supertest');
const assert = require('node:assert/strict');
const expressConfig = require('./../../../../config/lib/express.mjs');

describe('Request parsing middleware', function () {
  let app;

  beforeEach(function () {
    app = express();
    expressConfig.initMiddleware(app);
    app.all('/inspect', (req, res) => {
      res.json({ body: req.body, method: req.method, cookies: req.cookies });
    });
    // Express identifies error middleware by its four-argument signature.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ type: err.type });
    });
  });

  it('parses JSON and cookies', async function () {
    const response = await request(app)
      .post('/inspect')
      .set('Cookie', 'example=value')
      .send({ example: 'value' })
      .expect(200);
    assert.deepEqual(response.body, {
      body: { example: 'value' },
      method: 'POST',
      cookies: { example: 'value' },
    });
  });

  it('parses nested URL-encoded forms', async function () {
    const response = await request(app)
      .post('/inspect')
      .type('form')
      .send('example[nested]=value')
      .expect(200);
    assert.deepEqual(response.body.body, { example: { nested: 'value' } });
  });

  it('parses CSP report JSON', async function () {
    const report = { 'csp-report': { 'effective-directive': 'script-src' } };
    const response = await request(app)
      .post('/inspect')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify(report))
      .expect(200);
    assert.deepEqual(response.body.body, report);
  });

  it('rejects malformed JSON', async function () {
    const response = await request(app)
      .post('/inspect')
      .type('json')
      .send('{')
      .expect(400);
    assert.equal(response.body.type, 'entity.parse.failed');
  });

  it('retains the 100 KiB JSON body limit', async function () {
    const response = await request(app)
      .post('/inspect')
      .send({ example: 'x'.repeat(100 * 1024) })
      .expect(413);
    assert.equal(response.body.type, 'entity.too.large');
  });

  it('retains the form parameter limit', async function () {
    const response = await request(app)
      .post('/inspect')
      .type('form')
      .send(
        Array.from({ length: 1001 }, (_, i) => `example${i}=value`).join('&'),
      )
      .expect(413);
    assert.equal(response.body.type, 'parameters.too.many');
  });

  it('routes using the actual method when an override header is supplied', async function () {
    const response = await request(app)
      .post('/inspect')
      .set('X-HTTP-Method-Override', 'DELETE')
      .send({ example: 'value' })
      .expect(200);
    assert.equal(response.body.method, 'POST');
  });
});
