import express from 'express';
import session from 'express-session';
import proxyquire from './../../../../testutils/server/mock-module.mts';
import request from 'supertest';
import should from 'should';
import config from './../../../../config/config.mts';

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

const { Store } = session as unknown as { Store: new () => object };

class TestStore extends Store {
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

  async function createApp(): Promise<import('express').Application> {
    app = express();
    const { default: expressConfig } = await proxyquire<{
      default: ExpressConfig;
    }>(new URL('./../../../../config/lib/express.mts', import.meta.url), {
      'connect-mongo': { create: () => store },
    });

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
    const agent = request.agent(await createApp());
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
