const express = require('express');
const proxyquire = require('proxyquire').noCallThru();
const request = require('supertest');
require('should');

describe('Experiences routes unit tests', () => {
  function buildApp(referenceEnabled) {
    const app = express();
    proxyquire('../../server/routes/experiences.server.routes', {
      '../../../../config/config': {
        featureFlags: { reference: referenceEnabled },
      },
      '../policies/experiences.server.policy': {
        isAllowed: (req, res, next) => next(),
      },
      '../controllers/experiences.server.controller': {
        create: (req, res) => res.status(200).send({ action: 'create' }),
        readMany: (req, res) => res.status(200).send({ action: 'readMany' }),
        getCount: (req, res) => res.status(200).send({ action: 'getCount' }),
        getSuggestion: (req, res) =>
          res.status(200).send({ action: 'getSuggestion' }),
        readMine: (req, res) => res.status(200).send({ action: 'readMine' }),
        readOne: (req, res) => res.status(200).send({ action: 'readOne' }),
        experienceById: (req, res, next) => next(),
      },
    })(app);
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
