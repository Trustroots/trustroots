import type { UserDocument } from '../../../../testutils/server/model-contracts.mts';
import type { Request, Response } from 'express';

const mongoose: typeof import('mongoose') = require('mongoose');
require('should');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const request: typeof import('supertest') = require('supertest');
const webPush: {
  sendNotification(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: string,
  ): Promise<unknown>;
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
} = require('web-push');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const express: typeof import('../../../../config/lib/express.mjs').default = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
const push: typeof import('../../server/services/unified-push.server.service.mjs') = require('../../server/services/unified-push.server.service.mjs');
const Registration = mongoose.model<{
  user: import('mongoose').Types.ObjectId;
  endpoint: string;
  publicKey: string;
  auth: string;
}>('UnifiedPushRegistration');
const key =
  'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ';
const registration = {
  endpoint: 'https://ntfy.sh/anonymous-test-endpoint',
  publicKey: key,
  auth: 'abcdefghijklmnopqrstuv',
};
describe('UnifiedPush registration and unread-message delivery', function () {
  let app: import('express').Express;
  let agent: ReturnType<typeof request.agent>;
  let user: UserDocument;
  let other: UserDocument;
  let originalConfiguration: typeof config.webPush;
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async function () {
    originalConfiguration = {
      ...config.webPush,
    };
    const generated = utils.generateUsers(2);
    generated[0].password = 'AnonymousPass123!';
    [user, other] = await utils.saveUsers(generated);
    agent = request.agent(app);
    await utils.signIn(generated[0], agent);
  });
  afterEach(async function () {
    sinon.restore();
    config.webPush = originalConfiguration;
    await utils.clearDatabase();
  });
  it('exposes the service and controller from a fresh module load', function () {
    const mockModule: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
    const keysOf = (path: string) =>
      Object.keys(mockModule<object>(require.resolve(path), {}));
    keysOf(
      '../../server/services/unified-push.server.service.mts',
    ).should.deepEqual([
      'pushConfiguration',
      'validRegistration',
      'register',
      'unregister',
      'notifyUnread',
    ]);
    keysOf(
      '../../server/controllers/users.unified-push.server.controller.mts',
    ).should.deepEqual(['configuration', 'add', 'remove']);
  });
  it('reports configuration and rejects registration when disabled', async function () {
    config.webPush.privateKey = '';
    const settings = await agent.get('/api/users/unified-push').expect(200);
    settings.body.enabled.should.equal(false);
    await agent
      .post('/api/users/unified-push')
      .send(registration)
      .expect(503, { message: 'Message alerts are not configured.' });
    config.webPush = {
      ...originalConfiguration,
      publicKey: '',
    };
    const missingKey = await agent.get('/api/users/unified-push').expect(200);
    missingKey.body.enabled.should.equal(false);
    (missingKey.body.publicKey === null).should.equal(true);
  });
  it('rejects unsafe endpoints and invalid keys', async function () {
    for (const endpoint of [
      registration.endpoint,
      `https://ntfy.sh/${'x'.repeat(2048 - 16)}`,
    ]) {
      push.validRegistration({ ...registration, endpoint }).should.equal(true);
    }
    for (const changes of [
      {
        endpoint: 'http://ntfy.sh/a',
      },
      {
        endpoint: 'https://ntfy.sh.evil.example/a',
      },
      {
        endpoint: 'https://user@ntfy.sh/a',
      },
      {
        endpoint: 'https://ntfy.sh:444/a',
      },
      {
        endpoint: 'https://ntfy.sh/a#fragment',
      },
      {
        endpoint: 'bad-url',
      },
      {
        endpoint: 42,
      },
      {
        endpoint: `https://ntfy.sh/${'x'.repeat(2050)}`,
      },
      ...[[key], `!${key}`, `${key}!`].map(publicKey => ({ publicKey })),
      ...['bad', [registration.auth], `!${registration.auth}`].map(auth => ({
        auth,
      })),
      { auth: `${registration.auth}!` },
    ]) {
      push
        .validRegistration({
          ...registration,
          ...changes,
        })
        .should.equal(false);
    }
    await agent
      .post('/api/users/unified-push')
      .send({
        ...registration,
        endpoint: 'http://ntfy.sh/a',
      })
      .expect(400, { message: 'Invalid push endpoint or encryption keys.' });
  });
  it('rejects requests without a parsed body', async function () {
    const controller: {
      add(request: Request, response: Response): Promise<unknown>;
    } = require('./../../server/controllers/users.unified-push.server.controller.mjs');
    const response = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    await controller.add({} as Request, response as unknown as Response);
    response.status.calledOnceWithExactly(400).should.equal(true);
    response.json.calledOnce.should.equal(true);
  });
  it('attaches an endpoint to the current account and removes it on opt-out', async function () {
    await push.register(other._id, registration);
    await agent.post('/api/users/unified-push').send(registration).expect(204);
    const saved = await Registration.findOne({
      endpoint: registration.endpoint,
    });
    if (!saved) throw new Error('registration should be stored');
    saved.user.toString().should.equal(user._id.toString());
    saved.publicKey.should.equal(key);
    await agent
      .delete('/api/users/unified-push')
      .send({
        endpoint: registration.endpoint,
      })
      .expect(204);
    (await Registration.countDocuments()).should.equal(0);
    for (const body of [{}, { endpoint: 42 }]) {
      await agent
        .delete('/api/users/unified-push')
        .send(body)
        .expect(400, { message: 'Endpoint is required.' });
    }
  });
  it('does not remove another member’s endpoint', async function () {
    await push.register(other._id, registration);
    await agent
      .delete('/api/users/unified-push')
      .send({
        endpoint: registration.endpoint,
      })
      .expect(204);
    (await Registration.countDocuments()).should.equal(1);
  });
  it('reports storage failures without accepting a registration', async function () {
    const save = sinon
      .stub(Registration, 'findOneAndUpdate')
      .rejects(new Error('database unavailable'));
    await agent
      .post('/api/users/unified-push')
      .send(registration)
      .expect(500, { message: 'Could not register message alerts.' });
    save.restore();
    sinon
      .stub(Registration, 'deleteOne')
      .rejects(new Error('database unavailable'));
    await agent
      .delete('/api/users/unified-push')
      .send({
        endpoint: registration.endpoint,
      })
      .expect(500, { message: 'Could not remove message alerts.' });
  });
  it('sends an encrypted generic payload and removes a gone endpoint', async function () {
    const othersEndpoint = `${registration.endpoint}-other`;
    await push.register(other._id, {
      ...registration,
      endpoint: othersEndpoint,
    });
    const sent = sinon.stub(webPush, 'sendNotification').resolves();
    const vapid = sinon.stub(webPush, 'setVapidDetails');
    for (const statusCode of [404, 410]) {
      await push.register(user._id, registration);
      sent.resetHistory();
      await push.notifyUnread(user._id, other._id);
      sent.calledOnce.should.equal(true);
      sent.firstCall.args.should.deepEqual([
        {
          endpoint: registration.endpoint,
          keys: { p256dh: key, auth: registration.auth },
        },
        JSON.stringify({ senderId: other._id.toString() }),
        { TTL: 3600 },
      ]);
      vapid.lastCall.args.should.deepEqual([
        config.webPush.subject,
        config.webPush.publicKey,
        config.webPush.privateKey,
      ]);
      sent.rejects({ statusCode });
      await push.notifyUnread(user._id, other._id);
      sent.resolves();
      (await Registration.find())
        .map(r => r.endpoint)
        .should.deepEqual([othersEndpoint]);
    }
  });
  it('keeps registrations after a temporary push failure', async function () {
    await push.register(user._id, registration);
    const failure = { statusCode: 503 };
    sinon.stub(webPush, 'sendNotification').rejects(failure);
    sinon.stub(webPush, 'setVapidDetails');
    const log = sinon.stub(winston.Logger.prototype, 'log');
    await push.notifyUnread(user._id, other._id);
    (await Registration.countDocuments()).should.equal(1);
    log.calledOnce.should.equal(true);
    (log.firstCall.args as unknown[]).should.eql([
      'error',
      'UnifiedPush unread-message delivery failed.',
      { error: failure },
    ]);
  });
  it('does not send when Web Push is disabled', async function () {
    config.webPush.privateKey = '';
    const sent = sinon.stub(webPush, 'sendNotification');
    await push.notifyUnread(user._id, other._id);
    sent.called.should.equal(false);
  });
});
