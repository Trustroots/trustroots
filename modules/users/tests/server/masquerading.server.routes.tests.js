const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
require('should');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
const AuditLog = mongoose.model('AuditLog');

describe('View-only masquerading sessions', function () {
  let app;
  before(async function () {
    app = await express.init(mongoose.connection);
  });
  afterEach(utils.clearDatabase);
  it('preserves member data, blocks writes and restores the real administrator', async function () {
    const password = 'FictionalPassword123!';
    const base = {
      password,
      provider: 'local',
      firstName: 'Example',
      lastName: 'Member',
      displayName: 'Example Member',
      public: true,
    };
    const actor = await new User({
      ...base,
      username: 'exampleadmin',
      email: 'example-admin@example.test',
      roles: ['user', 'admin'],
    }).save();
    const target = await new User({
      ...base,
      username: 'examplemember',
      email: 'example-member@example.test',
      roles: ['user'],
      seen: new Date('2026-01-01'),
      lastIpAddress: '192.0.2.20',
    }).save();
    const before = await User.findById(target._id).lean();
    const agent = request.agent(app);
    await agent
      .post('/api/auth/signin')
      .send({ username: actor.username, password })
      .expect(200);
    await agent
      .post('/api/auth/masquerade')
      .set('Origin', 'https://elsewhere.example')
      .send({
        targetId: target.id,
        password,
        reason: 'Reproduce a display problem',
      })
      .expect(403);
    await agent
      .post('/api/auth/masquerade')
      .send({
        targetId: target.id,
        password: 'incorrect',
        reason: 'Reproduce a display problem',
      })
      .expect(403);
    const started = await agent
      .post('/api/auth/masquerade')
      .send({
        targetId: target.id,
        password,
        reason: 'Reproduce a display problem',
      })
      .expect(200);
    const cookie = started.headers['set-cookie'][0].split(';')[0];
    const session = await agent.get('/api/auth/session').expect(200);
    session.body.userId.should.equal(target.id);
    const headers = { 'X-Trustroots-View': session.body.viewGeneration };
    const profile = await agent
      .get(`/api/users/${target.username}`)
      .set(headers)
      .expect(200);
    profile.body._id.should.equal(target.id);
    profile.body.public.should.be.true();
    const document = await agent.get(`/profile/${target.username}`).expect(200);
    document.text.should.containEql(target.email);
    profile.headers['cache-control'].should.equal('no-store');
    for (const [method, path] of [
      ['put', '/api/users'],
      ['put', '/API/USERS'],
      ['get', '/api/users/EXPORT'],
      ['post', '/api/messages-read'],
      ['post', '/api/messages'],
      ['get', '/api/admin/dashboard'],
      ['get', '/api/users/export'],
      ['get', '/api/users/unified-push'],
    ]) {
      const response = await agent[method](path)
        .set(headers)
        .send({ description: 'Unwanted edit' })
        .expect(403);
      response.body.code.should.equal('VIEW_READ_ONLY');
    }
    await agent.get(`/api/users/${target.username}`).expect(409);
    const after = await User.findById(target._id).lean();
    after.should.deepEqual(before);
    const events = await AuditLog.find({ user: actor._id }).lean();
    events.some(event => event.route === 'masquerade:start').should.be.true();
    events.some(event => event.route === 'masquerade:read').should.be.true();
    JSON.stringify(events).includes(password).should.be.false();
    const clock = sinon.useFakeTimers({
      toFake: ['Date'],
      now: Date.now() + 16 * 60 * 1000,
    });
    let stopped;
    try {
      const expired = await agent
        .get(`/api/users/${target.username}`)
        .set(headers)
        .expect(409);
      expired.body.code.should.equal('VIEW_EXPIRED');
      const expiredDocument = await agent.get('/signin').expect(200);
      expiredDocument.text.should.match(/"expired"\s*:\s*true/);
      expiredDocument.text.should.not.containEql(target.email);
      stopped = await agent
        .post('/api/auth/masquerade/stop')
        .set(headers)
        .send({})
        .expect(200);
    } finally {
      clock.restore();
    }
    stopped.headers['set-cookie'][0].split(';')[0].should.not.equal(cookie);
    const restored = await agent.get('/api/auth/session').expect(200);
    restored.body.userId.should.equal(actor.id);
    restored.body.viewGeneration.should.not.equal(session.body.viewGeneration);
    // A stale member tab cannot write as the restored administrator.
    await agent
      .put('/api/users')
      .set(headers)
      .send({ description: 'Unwanted edit' })
      .expect(409);
    await agent
      .get('/api/admin/dashboard')
      .set('X-Trustroots-View', restored.body.viewGeneration)
      .expect(200);
    const old = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(200);
    (old.body.userId === null).should.be.true();
  });
});
