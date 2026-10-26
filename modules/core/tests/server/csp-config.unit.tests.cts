const express: typeof import('express') = require('express');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert/strict') = require('assert/strict');
const headers =
  require('../../../../config/lib/express.mjs') as typeof import('../../../../config/lib/express.mjs').default & {
    initHelmetHeaders(app: import('express').Express): void;
  };

describe('Production content security policy', function () {
  let environment: string | undefined;
  beforeEach(() => {
    environment = process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env.NODE_ENV = environment;
  });
  async function response(environment: string) {
    process.env.NODE_ENV = environment;
    const app = express();
    headers.initHelmetHeaders(app);
    app.get('/', (req, res) => res.json({ nonce: res.locals.nonce }));
    return request(app).get('/').expect(200);
  }
  it('blocks eval, unnonced inline scripts and objects in production', async function () {
    const res = await response('production');
    const policy = res.headers['content-security-policy'];
    assert.ok(!policy.includes("'unsafe-eval'"));
    assert.ok(!policy.match(/script-src[^;]*'unsafe-inline'/));
    assert.ok(policy.includes("object-src 'none'"));
    assert.ok(policy.includes("'nonce-" + res.body.nonce + "'"));
    assert.ok(!policy.match(/script-src[^;]*\*\./));
    assert.ok(policy.includes("worker-src 'self' blob:"));
    assert.ok(!policy.includes('google-analytics.com'));
    assert.ok(!policy.includes('doubleclick.net'));
    assert.ok(policy.includes('https://1p.trustroots.org'));
    const connections = policy
      .split(';')
      .find(directive => directive.trim().startsWith('connect-src'));
    assert.ok(connections);
    assert.ok(connections.includes('wss://relay.trustroots.org'));
    assert.ok(connections.includes('wss://relay.nomadwiki.org'));
    assert.ok(connections.includes('wss://relay.maps.hitchwiki.org'));
    assert.notEqual(res.body.nonce, (await response('production')).body.nonce);
  });
  it('retains development eval source maps in report-only mode', async function () {
    const res = await response('development');
    assert.ok(
      res.headers['content-security-policy-report-only'].includes(
        "'unsafe-eval'",
      ),
    );
    assert.equal(res.headers['content-security-policy'], undefined);
  });
});
