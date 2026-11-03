const express: typeof import('express') = require('express');
const session: {
  Store: new () => import('node:events').EventEmitter;
} = require('express-session');
const proxyquire: typeof import('./../../../../testutils/server/mock-module') = require('./../../../../testutils/server/mock-module');
const request: typeof import('supertest') = require('supertest');
const should: typeof import('should') = require('should');
type SessionConfig = { https: boolean; sessionProxy: boolean };
const config: SessionConfig = require('./../../../../config/config.mts');

type ExpressConfig = {
  initMiddleware(app: import('express').Application): void;
  initSession(app: import('express').Application, options: object): void;
};
type SessionData = Record<string, unknown>;
type SessionCallback = (error?: Error | null) => void;
type SessionGetCallback = (
  error: Error | null,
  value?: SessionData | null,
) => void;

class TestStore extends session.Store {
  sessions: Map<string, SessionData>;
  setCalls: number;
  touchCalls: number;

  constructor() {
    super();
    this.sessions = new Map();
    this.setCalls = 0;
    this.touchCalls = 0;
  }

  get(id: string, callback: SessionGetCallback): void {
    callback(null, this.sessions.get(id));
  }

  set(id: string, value: SessionData, callback: SessionCallback): void {
    this.setCalls += 1;
    this.sessions.set(id, value);
    callback(null);
  }

  touch(id: string, value: SessionData, callback: SessionCallback): void {
    this.touchCalls += 1;
    this.sessions.set(id, value);
    callback(null);
  }

  destroy(id: string, callback: SessionCallback): void {
    this.sessions.delete(id);
    callback(null);
  }
}

describe('Session configuration', function () {
  let store: TestStore;
  let app: import('express').Application;
  let originalHttps: boolean;
  let originalSessionProxy: boolean;

  beforeEach(function () {
    originalHttps = config.https;
    originalSessionProxy = config.sessionProxy;
    store = new TestStore();
  });

  afterEach(function () {
    config.https = originalHttps;
    config.sessionProxy = originalSessionProxy;
  });

  function createApp(): import('express').Application {
    app = express();
    const expressConfig: ExpressConfig = proxyquire(
      require.resolve('./../../../../config/lib/express.mts'),
      {
        'connect-mongo': { create: () => store },
      },
    );

    expressConfig.initMiddleware(app);
    expressConfig.initSession(app, { getClient: () => ({}) });
    app.get('/api/mobile/v0/me', (req, res) =>
      res.json({ hasSession: 'session' in req }),
    );
    app.get('/api/mobile/v0-other', (req, res) =>
      res.json({ hasSession: 'session' in req }),
    );
    app.get('/change', (req, res) => {
      const sessionRequest = req as import('express').Request & {
        session: SessionData;
      };
      sessionRequest.session.value = 'saved';
      res.send('changed');
    });
    return app;
  }

  it('ignores browser sessions on mobile routes while retaining neighbouring browser routes', async function () {
    config.https = false;
    config.sessionProxy = false;
    const agent = request.agent(createApp());
    await agent.get('/change').expect(200);

    const mobile = await agent.get('/api/mobile/v0/me').expect(200);
    mobile.body.hasSession.should.equal(false);
    should(mobile.headers['set-cookie']).be.undefined();
    store.touchCalls.should.equal(0);

    const browser = await agent.get('/api/mobile/v0-other').expect(200);
    browser.body.hasSession.should.equal(true);
    store.touchCalls.should.equal(1);
  });
});
