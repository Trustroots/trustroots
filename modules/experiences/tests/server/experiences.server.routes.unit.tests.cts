import type { TestConfigModule } from '../../../../testutils/server/model-contracts.mts';
const express: typeof import('express') = require('express');
const sinon: typeof import('sinon') = require('sinon');
const config: TestConfigModule = require('../../../../config/config.mjs');
const policy: typeof import('../../server/policies/experiences.server.policy.mts') = require('../../server/policies/experiences.server.policy.mts');
const controller: typeof import('../../server/controllers/experiences.server.controller.mjs') = require('../../server/controllers/experiences.server.controller.mjs');
const changes: typeof import('../../server/controllers/experience-changes.server.controller.mjs') = require('../../server/controllers/experience-changes.server.controller.mjs');
const registerRoutes: typeof import('../../server/routes/experiences.server.routes.mjs').default = require('../../server/routes/experiences.server.routes.mjs');
const request: typeof import('supertest') = require('supertest');
require('should');

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
    const app = buildApp(true);
    const res = await request(app).get('/api/experiences');
    res.status.should.equal(200);
    res.body.action.should.equal('readMany');

    const suggestion = await request(app).get('/api/experiences/suggestion');
    suggestion.status.should.equal(200);
    suggestion.body.action.should.equal('getSuggestion');
  });
});
