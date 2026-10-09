const express = require('express');
const session = require('express-session');
const proxyquire = require('./../../../../testutils/server/mock-module');
const request = require('supertest');
const should = require('should');
const config = require('./../../../../config/config.mjs');

class TestStore extends session.Store {
  constructor() {
    super();
    this.sessions = new Map();
    this.setCalls = 0;
    this.touchCalls = 0;
  }

  get(id, callback) {
    callback(null, this.sessions.get(id));
  }

  set(id, value, callback) {
    this.setCalls += 1;
    this.sessions.set(id, value);
    callback(null);
  }

  touch(id, value, callback) {
    this.touchCalls += 1;
    this.sessions.set(id, value);
    callback(null);
  }

  destroy(id, callback) {
    this.sessions.delete(id);
    callback(null);
  }
}

describe('Session configuration', function () {
  let store;
  let app;
  let originalHttps;
  let originalSessionProxy;

  beforeEach(function () {
    originalHttps = config.https;
    originalSessionProxy = config.sessionProxy;
    store = new TestStore();
  });

  afterEach(function () {
    config.https = originalHttps;
    config.sessionProxy = originalSessionProxy;
  });

  function createApp() {
    app = express();
    const expressConfig = proxyquire(
      require.resolve('./../../../../config/lib/express.mjs'),
      {
        'connect-mongo': { create: () => store },
      },
    );

    expressConfig.initSession(app, {});
    app.get('/visit', (req, res) => res.send('visited'));
    app.get('/change', (req, res) => {
      req.session.value = 'saved';
      res.send('changed');
    });
    return app;
  }

  it('does not save or issue cookies for uninitialised requests', async function () {
    config.https = false;
    config.sessionProxy = false;

    const response = await request(createApp()).get('/visit').expect(200);

    should(response.headers['set-cookie']).be.undefined();
    store.setCalls.should.equal(0);
    store.touchCalls.should.equal(0);
  });

  it('issues HttpOnly SameSite=Lax cookies after a session is changed', async function () {
    config.https = false;
    config.sessionProxy = false;

    const response = await request(createApp()).get('/change').expect(200);
    const cookie = response.headers['set-cookie'][0];

    cookie.should.match(/HttpOnly/);
    cookie.should.match(/SameSite=Lax/);
    cookie.should.not.match(/; Secure(?:;|$)/);
    store.setCalls.should.equal(1);
  });

  it('ignores forwarded HTTPS unless the session proxy is explicitly trusted', async function () {
    config.https = true;
    config.sessionProxy = false;

    const response = await request(createApp())
      .get('/change')
      .set('X-Forwarded-Proto', 'https')
      .expect(200);

    should(response.headers['set-cookie']).be.undefined();
  });

  it('marks session cookies Secure when HTTPS is forwarded by a trusted proxy', async function () {
    config.https = true;
    config.sessionProxy = true;

    const response = await request(createApp())
      .get('/change')
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const cookie = response.headers['set-cookie'][0];

    cookie.should.match(/; Secure(?:;|$)/);
    cookie.should.match(/HttpOnly/);
    cookie.should.match(/SameSite=Lax/);
  });

  it('touches stored sessions on unchanged requests without rewriting them', async function () {
    config.https = false;
    config.sessionProxy = false;
    const agent = request.agent(createApp());

    await agent.get('/change').expect(200);
    await agent.get('/visit').expect(200);

    store.setCalls.should.equal(1);
    store.touchCalls.should.equal(1);
  });
});
