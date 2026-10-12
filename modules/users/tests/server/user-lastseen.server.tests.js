const request = require('supertest');
const moment = require('moment');
const mongoose = require('mongoose');
const should = require('should');
const sinon = require('sinon');
const config = require('./../../../../config/config.mjs');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const lastSeen = require('./../../server/controllers/users.lastseen.server.controller.mjs');
const User = mongoose.model('User');
describe('User last seen CRUD tests', function () {
  /**
   * Globals
   */
  let app;
  let agent;
  let _confirmedUser;
  let confirmedUser;
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(function () {
    sinon.useFakeTimers({
      // MongoDB uses real time to expire authentication sessions.
      now: Date.now(),
      toFake: ['Date'],
    });
  });
  afterEach(function () {
    sinon.restore();
  });

  // Create a confirmed user

  beforeEach(async function () {
    _confirmedUser = {
      public: true,
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'confirmed-test@test.com',
      username: 'usertest',
      password: 'aPassWoRd_*....',
      provider: 'local',
    };
    confirmedUser = new User(_confirmedUser);

    // Save a user to the test db
    await confirmedUser.save();
  });
  afterEach(utils.clearDatabase);
  context('logged in', function () {
    // Sign in
    beforeEach(async () => {
      const credentials = {
        username: _confirmedUser.username,
        password: _confirmedUser.password,
      };
      await utils.signIn(credentials, agent);
    });

    // Sign out
    afterEach(async () => {
      await utils.signOut(agent);
    });
    afterEach(utils.clearDatabase);
    it('should update the last seen date of logged user when accessing api', async function () {
      sinon.clock.tick(20);
      await agent.get('/api/messages').expect(200);

      const user = await User.findOne({ username: _confirmedUser.username });
      should(user.seen).eql(new Date());
      user.lastIpAddress.should.be.String();
    });
    it('prefers the trusted Passenger client address', () => {
      const req = {
        get: header =>
          header === '!~Passenger-Client-Address' ? '203.0.113.24' : undefined,
        ip: '198.51.100.24',
      };
      lastSeen.getClientIpAddress(req).should.equal('203.0.113.24');
    });
    it('uses the socket-derived request address when Passenger is unavailable', () => {
      const req = {
        get: () => undefined,
        ip: '2001:db8::1',
      };
      lastSeen.getClientIpAddress(req).should.equal('2001:db8::1');
    });
    it('does not store an invalid client address', () => {
      const req = {
        get: () => 'not-an-ip-address',
        ip: 'not-an-ip-address',
      };
      should(lastSeen.getClientIpAddress(req)).be.undefined();
    });
    it('updates a changed IP address without advancing the last-seen timestamp', async () => {
      const findByIdAndUpdate = sinon
        .stub(User, 'findByIdAndUpdate')
        .resolves();
      const req = {
        get: () => '203.0.113.24',
        ip: '198.51.100.24',
        user: {
          id: 'user-id',
          lastIpAddress: '203.0.113.23',
          seen: new Date(),
        },
      };
      await new Promise((resolve, reject) => {
        lastSeen(req, {}, err => (err ? reject(err) : resolve()));
      });
      sinon.assert.calledOnce(findByIdAndUpdate);
      findByIdAndUpdate.firstCall.args[0].should.equal('user-id');
      findByIdAndUpdate.firstCall.args[1].should.deepEqual({
        lastIpAddress: '203.0.113.24',
      });
    });
    it('should update the last seen date only if a specific time passed since the last update', async function () {
      const username = _confirmedUser.username;

      const minutesToUpdate = {
        minutes: 1,
      };

      sinon
        .stub(config.limits, 'timeToUpdateLastSeenUser')
        .value(minutesToUpdate);
      const timeToUpdate = moment.duration(minutesToUpdate).asMilliseconds();
      const originalTime = new Date();

      await agent.get('/api/messages').expect(200);
      let user = await User.findOne({ username });
      should(user.seen).eql(originalTime);

      sinon.clock.tick(timeToUpdate - 1);
      await agent.get('/api/messages').expect(200);
      user = await User.findOne({ username });
      should(user.seen).eql(originalTime);

      sinon.clock.tick(2);
      await agent.get('/api/messages').expect(200);
      user = await User.findOne({ username });
      should(user.seen).eql(new Date());
    });
  });
});
