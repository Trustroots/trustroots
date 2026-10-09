const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
require('should');
const config = require('./../../../../config/config.mjs');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const {
  confirmAdminPassword,
  elevationLifetimeMs,
} = require('../../server/services/admin-elevation.server.service.mjs');

describe('Admin elevation route tests', () => {
  let app;
  const usersRaw = utils.generateUsers(2);
  usersRaw[0].roles = ['user', 'admin'];
  usersRaw[1].roles = ['user'];

  before(async function () {
    app = await express.init(mongoose.connection);
  });

  beforeEach(async () => {
    await utils.saveUsers(usersRaw);
  });
  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  it('uses a half-hour default when no elevation lifetime is configured', () => {
    sinon.stub(config, 'adminElevation').value(undefined);
    elevationLifetimeMs().should.equal(30 * 60 * 1000);
  });

  it('keeps the member signed in while requiring password step-up for admin APIs', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/signin')
      .send({
        username: usersRaw[0].username,
        password: usersRaw[0].password,
      })
      .expect(200);

    const blocked = await agent.get('/api/admin/dashboard').expect(403);
    blocked.body.code.should.equal('ADMIN_ELEVATION_REQUIRED');

    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({})
      .expect(400);
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: '' })
      .expect(400);
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: 'x'.repeat(1025) })
      .expect(400);

    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: 'wrong-password' })
      .expect(400);

    const elevated = await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: usersRaw[0].password })
      .expect(200);
    elevated.body.elevatedUntil.should.be.a.String();

    await agent.get('/api/admin/dashboard').expect(200);

    const session = await agent.get('/api/auth/session').expect(200);
    session.body.userId.should.be.ok();
  });

  it('does not elevate regular members', async () => {
    const agent = request.agent(app);
    await utils.signIn(
      {
        username: usersRaw[1].username,
        password: usersRaw[1].password,
      },
      agent,
    );
    await agent
      .post('/api/admin/elevate')
      .set('X-Trustroots-Request', '1')
      .send({ password: usersRaw[1].password })
      .expect(403);
    await agent.get('/api/admin/dashboard').expect(403);
  });

  it('rejects step-up when the member authentication version changed', async () => {
    const user = await mongoose
      .model('User')
      .findOne({ username: usersRaw[0].username });
    await mongoose
      .model('User')
      .updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let nextCalled = false;
    await confirmAdminPassword(
      {
        body: { password: usersRaw[0].password },
        user: { _id: user._id, authVersion: 0 },
      },
      res,
      () => {
        nextCalled = true;
      },
    );
    res.statusCode.should.equal(403);
    res.body.message.should.equal('Sign in again.');
    nextCalled.should.be.false();
  });

  it('forwards account lookup errors while confirming the password', async () => {
    const res = {
      status() {
        return this;
      },
      json() {
        return this;
      },
    };
    let nextError;
    await confirmAdminPassword(
      { body: { password: 'Password123!' }, user: { _id: 'not-an-id' } },
      res,
      error => {
        nextError = error;
      },
    );
    nextError.should.be.instanceOf(Error);
  });
});
