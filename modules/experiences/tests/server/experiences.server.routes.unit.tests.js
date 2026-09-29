const express = require('express');
const sinon = require('sinon');
const config = require('../../../../config/config');
const policy = require('../../server/policies/experiences.server.policy');
const controller = require('../../server/controllers/experiences.server.controller');
const registerRoutes = require('../../server/routes/experiences.server.routes');
const request = require('supertest');
require('should');

describe('Experiences routes unit tests', () => {
  afterEach(() => sinon.restore());
  function buildApp(referenceEnabled) {
    const app = express();
    sinon.stub(config.featureFlags, 'reference').value(referenceEnabled);
    sinon.stub(policy, 'isAllowed').callsFake((req, res, next) => next());
    for (const name of [
      'create',
      'readMany',
      'getCount',
      'getSuggestion',
      'readMine',
      'readOne',
    ]) {
      sinon
        .stub(controller, name)
        .callsFake((req, res) => res.status(200).send({ action: name }));
    }
    sinon
      .stub(controller, 'experienceById')
      .callsFake((req, res, next) => next());
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
