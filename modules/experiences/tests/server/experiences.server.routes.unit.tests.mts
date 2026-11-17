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
    const app = buildApp(true);
    const res = await request(app).get('/api/experiences');
    res.status.should.equal(200);
    res.body.action.should.equal('readMany');

    const suggestion = await request(app).get('/api/experiences/suggestion');
    suggestion.status.should.equal(200);
    suggestion.body.action.should.equal('getSuggestion');
    const recipient = await request(app).get(
      '/api/experiences/reply-recipient/member',
    );
    recipient.status.should.equal(200);
    recipient.body.action.should.equal('readReplyRecipient');
  });
});
