const mongoose = require('mongoose');
const request = require('supertest');
require('should');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

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
});
