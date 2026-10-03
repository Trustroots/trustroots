const mongoose = require('mongoose');
require('should');
const sinon = require('sinon');
const request = require('supertest');
const webPush = require('web-push');
const config = require('../../../../config/config');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const push = require('../../server/services/unified-push.server.service');
const Registration = mongoose.model('UnifiedPushRegistration');
const key =
  'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ';
const registration = {
  endpoint: 'https://ntfy.sh/anonymous-test-endpoint',
  publicKey: key,
  auth: 'abcdefghijklmnopqrstuv',
};

describe('UnifiedPush registration and unread-message delivery', function () {
  let app;
  let agent;
  let user;
  let other;
  let originalConfiguration;

  before(function () {
    app = express.init(mongoose.connection);
  });

  beforeEach(async function () {
    originalConfiguration = { ...config.webPush };
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

  it('reports configuration and rejects registration when disabled', async function () {
    config.webPush.privateKey = '';
    const settings = await agent.get('/api/users/unified-push').expect(200);
    settings.body.enabled.should.equal(false);
    await agent.post('/api/users/unified-push').send(registration).expect(503);
    config.webPush = { ...originalConfiguration, publicKey: '' };
    const missingKey = await agent.get('/api/users/unified-push').expect(200);
    missingKey.body.enabled.should.equal(false);
    (missingKey.body.publicKey === null).should.equal(true);
  });

  it('rejects unsafe endpoints and invalid keys', async function () {
    push.validRegistration(registration).should.equal(true);
    for (const changes of [
      { endpoint: 'http://ntfy.sh/a' },
      { endpoint: 'https://ntfy.sh.evil.example/a' },
      { endpoint: 'https://user@ntfy.sh/a' },
      { endpoint: 'https://ntfy.sh:444/a' },
      { endpoint: 'https://ntfy.sh/a#fragment' },
      { endpoint: 'bad-url' },
      { endpoint: 42 },
      { endpoint: `https://ntfy.sh/${'x'.repeat(2050)}` },
      { publicKey: 'bad' },
      { auth: 'bad' },
    ]) {
      push
        .validRegistration({ ...registration, ...changes })
        .should.equal(false);
    }
    await agent
      .post('/api/users/unified-push')
      .send({ ...registration, endpoint: 'http://ntfy.sh/a' })
      .expect(400);
    await agent.post('/api/users/unified-push').expect(400);
  });

  it('rejects requests without a parsed body', async function () {
    const controller = require('../../server/controllers/users.unified-push.server.controller');
    const response = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };

    await controller.add({}, response);

    response.status.calledOnceWithExactly(400).should.equal(true);
    response.json.calledOnce.should.equal(true);
  });

  it('attaches an endpoint to the current account and removes it on opt-out', async function () {
    await push.register(other._id, registration);
    await agent.post('/api/users/unified-push').send(registration).expect(204);
    const saved = await Registration.findOne({
      endpoint: registration.endpoint,
    });
    saved.user.toString().should.equal(user._id.toString());
    saved.publicKey.should.equal(key);
    await agent
      .delete('/api/users/unified-push')
      .send({ endpoint: registration.endpoint })
      .expect(204);
    (await Registration.countDocuments()).should.equal(0);
    await agent.delete('/api/users/unified-push').send({}).expect(400);
  });

  it('does not remove another member’s endpoint', async function () {
    await push.register(other._id, registration);
    await agent
      .delete('/api/users/unified-push')
      .send({ endpoint: registration.endpoint })
      .expect(204);
    (await Registration.countDocuments()).should.equal(1);
  });

  it('reports storage failures without accepting a registration', async function () {
    const save = sinon
      .stub(Registration, 'findOneAndUpdate')
      .rejects(new Error('database unavailable'));
    await agent.post('/api/users/unified-push').send(registration).expect(500);
    save.restore();
    sinon
      .stub(Registration, 'deleteOne')
      .rejects(new Error('database unavailable'));
    await agent
      .delete('/api/users/unified-push')
      .send({ endpoint: registration.endpoint })
      .expect(500);
  });

  it('sends an encrypted generic payload and removes a gone endpoint', async function () {
    await push.register(user._id, registration);
    const sent = sinon.stub(webPush, 'sendNotification').resolves();
    sinon.stub(webPush, 'setVapidDetails');
    await push.notifyUnread(user._id, other._id);
    sent.calledOnce.should.equal(true);
    sent.firstCall.args[0].keys.should.deepEqual({
      p256dh: key,
      auth: registration.auth,
    });
    sent.firstCall.args[1].should.equal(
      JSON.stringify({ senderId: other._id.toString() }),
    );
    sent.rejects({ statusCode: 410 });
    await push.notifyUnread(user._id, other._id);
    (await Registration.countDocuments()).should.equal(0);
  });

  it('keeps registrations after a temporary push failure', async function () {
    await push.register(user._id, registration);
    sinon.stub(webPush, 'sendNotification').rejects({ statusCode: 503 });
    sinon.stub(webPush, 'setVapidDetails');
    await push.notifyUnread(user._id, other._id);
    (await Registration.countDocuments()).should.equal(1);
  });

  it('does not send when Web Push is disabled', async function () {
    config.webPush.privateKey = '';
    const sent = sinon.stub(webPush, 'sendNotification');
    await push.notifyUnread(user._id, other._id);
    sent.called.should.equal(false);
  });
});
