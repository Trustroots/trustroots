const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');

describe('Sign-in session confirmation', function () {
  let app;

  before(async function () {
    app = await express.init(mongoose.connection);
  });

  afterEach(utils.clearDatabase);

  it('returns an anonymous identity without creating a cookie or allowing caching', async function () {
    const response = await request(app).get('/api/auth/session').expect(200);
    response.body.should.deepEqual({ userId: null });
    response.headers['cache-control'].should.equal('no-store');
    response.headers.vary.should.match(/Cookie/);
    should(response.headers['set-cookie']).be.undefined();
  });

  it('recognises the signed-in account only when its session cookie is returned', async function () {
    const credentials = {
      username: 'session-test-member',
      password: 'ExamplePassword123!',
    };
    const user = await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      displayName: 'Example Member',
      email: 'session-member@example.test',
      provider: 'local',
      roles: ['user'],
    }).save();
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    const response = await agent.get('/api/auth/session').expect(200);
    response.body.should.deepEqual({ userId: String(user._id) });
    response.headers['cache-control'].should.equal('no-store');
    response.headers.vary.should.match(/Cookie/);

    const withoutCookie = await request(app)
      .get('/api/auth/session')
      .expect(200);
    withoutCookie.body.should.deepEqual({ userId: null });
    await agent
      .post('/api/auth/signout')
      .set('X-Trustroots-Request', '1')
      .expect(302);
    const signedOut = await agent.get('/api/auth/session').expect(200);
    signedOut.body.should.deepEqual({ userId: null });
  });
});
