const request = require('supertest');
const mongoose = require('mongoose');
const should = require('should');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
describe('Volunteers page route tests', function () {
  let app;
  let agent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  afterEach(utils.clearDatabase);
  function createUser(username, roles) {
    const user = new User({
      public: true,
      firstName: username,
      lastName: 'Tester',
      displayName: username + ' Tester',
      email: username + '@example.com',
      username,
      password: 'M3@n.jsI$Aw3$0m3',
      provider: 'local',
      roles,
    });
    return user.save();
  }
  it('should group users by volunteer and volunteer-alumni roles', async function () {
    await createUser('activevolunteer', ['user', 'volunteer']);
    await createUser('oldvolunteer', ['user', 'volunteer-alumni']);
    await createUser('regularuser', ['user']);
    const res = await agent.get('/api/volunteers').expect(200);
    res.body.volunteers.length.should.equal(1);
    res.body.alumni.length.should.equal(1);
    res.body.volunteers[0].username.should.equal('activevolunteer');
    res.body.volunteers[0].firstName.should.equal('activevolunteer');
    should.exist(res.body.volunteers[0]._id);
    // Only whitelisted fields are returned
    should.not.exist(res.body.volunteers[0].email);
    res.body.alumni[0].username.should.equal('oldvolunteer');
  });
  it('should return empty arrays when there are no volunteers', async function () {
    await createUser('regularuser', ['user']);
    const res = await agent.get('/api/volunteers').expect(200);
    res.body.volunteers.should.be.an.Array();
    res.body.volunteers.length.should.equal(0);
    res.body.alumni.length.should.equal(0);
  });

  it('returns only public current greeters with public fields in name order', async function () {
    await User.create([
      {
        public: true,
        firstName: 'Zed',
        lastName: 'Greeter',
        displayName: 'Zed Greeter',
        email: 'zed@example.com',
        username: 'zedgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
      {
        public: true,
        firstName: 'Ada',
        lastName: 'Greeter',
        displayName: 'Ada Greeter',
        email: 'ada@example.com',
        username: 'adagreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
      {
        public: true,
        firstName: 'Suspended',
        lastName: 'Greeter',
        email: 'suspended@example.com',
        username: 'suspendedgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team', 'suspended'],
      },
      {
        public: true,
        firstName: 'Shadowbanned',
        lastName: 'Greeter',
        email: 'shadow@example.com',
        username: 'shadowgreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team', 'shadowban'],
      },
      {
        public: false,
        firstName: 'Private',
        lastName: 'Greeter',
        email: 'private@example.com',
        username: 'privategreeter',
        password: 'M3@n.jsI$Aw3$0m3',
        provider: 'local',
        roles: ['user', 'welcome-team'],
      },
    ]);

    const response = await agent.get('/api/greeters').expect(200);

    response.body.greeters
      .map(({ displayName }) => displayName)
      .should.deepEqual(['Ada Greeter', 'Zed Greeter']);
    response.body.greeters.forEach(greeter => {
      Object.keys(greeter)
        .sort()
        .should.deepEqual(['_id', 'displayName', 'username']);
    });
  });

  it('returns an empty public greeter roster when no current greeters exist', async function () {
    const response = await agent.get('/api/greeters').expect(200);
    response.body.should.deepEqual({ greeters: [] });
  });
});
