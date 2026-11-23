import express from 'express';
import request from 'supertest';
import assert from 'assert/strict';
import imported3 from './../../../../config/lib/express.mts';

const headers =
  imported3 as typeof import('../../../../config/lib/express.mts').default & {
    initSecurityHeaders(app: import('express').Express): void;
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
    headers.initSecurityHeaders(app);
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
    assert.ok(new Set(policy.split(/\s+/)).has('https://1p.trustroots.org'));
    const connections = policy
      .split(';')
      .find(directive => directive.trim().startsWith('connect-src'));
    assert.ok(connections);
    const connectionSources = new Set(connections.trim().split(/\s+/));
    assert.ok(connectionSources.has('https://tiles.openfreemap.org'));
    assert.ok(connectionSources.has('https://api.mapbox.com'));
    assert.ok(!connectionSources.has('https://events.mapbox.com'));
    assert.ok(connectionSources.has('wss://relay.trustroots.org'));
    assert.ok(connectionSources.has('wss://relay.nomadwiki.org'));
    assert.ok(connectionSources.has('wss://relay.maps.hitchwiki.org'));
    assert.notEqual(res.body.nonce, (await response('production')).body.nonce);
  });
  it('sets the other security headers and none of the obsolete ones', async function () {
    const res = await response('production');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['strict-transport-security'], 'max-age=15778476');
    assert.ok(
      res.headers['content-security-policy'].includes("frame-ancestors 'none'"),
    );
    assert.ok(
      res.headers['content-security-policy'].includes("script-src-attr 'none'"),
    );
    assert.ok(
      res.headers['content-security-policy'].includes(
        'upgrade-insecure-requests',
      ),
    );
    assert.equal(res.headers['x-xss-protection'], undefined);
    assert.equal(res.headers['x-download-options'], undefined);
    assert.equal(res.headers['x-powered-by'], undefined);
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
