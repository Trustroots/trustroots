import express from 'express';
import sinon from 'sinon';
import config from '../../../../config/config.mts';
import policy from '../../server/policies/experiences.server.policy.mts';
import controller from '../../server/controllers/experiences.server.controller.mts';
import changes from '../../server/controllers/experience-changes.server.controller.mts';
import registerRoutes from '../../server/routes/experiences.server.routes.mts';
import request from 'supertest';
import 'should';

describe('Experiences routes unit tests', () => {
  afterEach(() => sinon.restore());
  function buildApp(referenceEnabled: boolean) {
    const app = express();
    sinon.stub(config.featureFlags, 'reference').value(referenceEnabled);
    sinon.stub(policy, 'isAllowed').callsFake(async (req, res, next) => {
      next();
    });
    sinon.stub(policy, 'isAllowedChange').callsFake(async (req, res, next) => {
      next();
    });
    for (const name of [
      'create',
      'readMany',
      'getCount',
      'getSuggestion',
      'readReplyRecipient',
      'readMine',
      'readOne',
    ] as const) {
      sinon.stub(controller, name).callsFake(async (req, res) => {
        res.status(200).json({ action: name } as never);
      });
    }
    sinon
      .stub(controller, 'experienceById')
      .callsFake((req, res, next) => next());
    for (const name of ['readAccess', 'submit', 'readMine'] as const) {
      sinon.stub(changes, name).callsFake(async (req, res) => {
        res.status(200).json({ action: name } as never);
      });
    }
    registerRoutes(app);
    return app;
  }

  it('does not register experience routes when reference is disabled', async () => {
    const app = buildApp(false);
    const res = await request(app).get('/api/experiences');
    res.status.should.equal(404);
  });

  it('registers experience routes when reference is enabled', async () => {
    const client = request(buildApp(true));
    for (const [method, path, action] of [
      ['post', '/api/experiences', 'create'],
      ['get', '/api/experiences', 'readMany'],
      ['get', '/api/experiences/count', 'getCount'],
      ['get', '/api/experiences/suggestion', 'getSuggestion'],
      ['get', '/api/experiences/reply-recipient/member', 'readReplyRecipient'],
      ['get', '/api/my-experience', 'readMine'],
      ['get', '/api/experiences/000000000000000000000001', 'readOne'],
      [
        'get',
        '/api/experiences/000000000000000000000001/change-access',
        'readAccess',
      ],
      [
        'post',
        '/api/experiences/000000000000000000000001/change-requests',
        'submit',
      ],
      [
        'get',
        '/api/experiences/000000000000000000000001/change-requests/mine',
        'readMine',
      ],
    ] as const) {
      await client[method](path).expect(200, { action });
    }
  });

  it('shares a client limit across routes before loading experiences', async () => {
    const app = buildApp(true);
    const client = request(app);
    const first = await client
      .get('/api/experiences/count')
      .expect(200)
      .expect('RateLimit-Policy', /q=120; w=60;/);
    (first.headers['x-ratelimit-limit'] === undefined).should.equal(true);

    for (let count = 1; count < 120; count++) {
      await client.get('/api/experiences/count').expect(200);
    }

    await client
      .get('/api/experiences/000000000000000000000001')
      .expect(429, {
        message: 'Too many experience requests. Please try again later.',
      })
      .expect('Retry-After', /^\d+$/);
    sinon.assert.notCalled(controller.experienceById as sinon.SinonStub);

    Object.defineProperty(app.request, 'ip', { value: undefined });
    await client.get('/api/experiences/count').expect(200);
  });
});
