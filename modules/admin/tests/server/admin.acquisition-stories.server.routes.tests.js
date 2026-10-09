const mongoose = require('mongoose');
const request = require('supertest');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');
describe('Admin acquisition stories CRUD tests', () => {
  let app;
  let agent;
  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // Get application

  const acquisitionStories = [
    'A fictional friend.',
    'A fictional gathering.',
    'A fictional recommendation.',
  ];
  let credentialsAdmin;
  let credentialsRegular;
  beforeEach(async () => {
    const users = utils
      .generateUsersWithSharedPassword(acquisitionStories.length)
      .map((user, index) => {
        user.acquisitionStory = acquisitionStories[index];
        return user;
      });
    users[0].roles = ['user', 'admin'];
    users[2].roles = ['user', 'shadowban', 'suspended', 'volunteer'];
    const savedUsers = await utils.saveUsersWithCachedPasswords(users);
    credentialsAdmin = {
      username: savedUsers[0].username,
      password: users[0].password,
    };
    credentialsRegular = {
      username: savedUsers[1].username,
      password: users[1].password,
    };
  });
  afterEach(utils.clearDatabase);
  describe('Acquisition stories', () => {
    it('non-authenticated users should not be allowed to read acquisition stories', async () => {
      await agent
        .post('/api/admin/acquisition-stories')
        .set('X-Trustroots-Request', '1')
        .expect(403);
    });
    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });
      it('non-admin users should not be allowed to read acquisition stories', async () => {
        await utils.signIn(credentialsRegular, agent);
        await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(403);
      });
      it('greeters can read restriction statuses but cannot change roles', async () => {
        await mongoose
          .model('User')
          .updateOne(
            { username: credentialsRegular.username },
            { $set: { roles: ['user', 'welcome-team'] } },
          );
        await utils.signIn(credentialsRegular, agent);
        const { body } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        const target = body.find(
          row => row.acquisitionStory === acquisitionStories[2],
        );
        target.restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
        body
          .find(row => row.username === credentialsRegular.username)
          .restrictionStatuses.should.deepEqual([]);
        await agent
          .post('/api/admin/user/change-role')
          .set('X-Trustroots-Request', '1')
          .send({ id: target._id, role: 'shadowban', action: 'remove' })
          .expect(403);
      });
      it('admin users should be allowed to read acquisition stories', async () => {
        await utils.signIn(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/acquisition-stories')
          .set('X-Trustroots-Request', '1')
          .expect(200);
        body.length.should.equal(acquisitionStories.length);
        body
          .find(row => row.acquisitionStory === acquisitionStories[2])
          .restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
        body.every(row => !Object.hasOwn(row, 'roles')).should.equal(true);
      });
    });
  });
  it('returns 404 for the retired analysis API', async () => {
    await utils.signIn(credentialsAdmin, agent);
    try {
      await agent
        .post('/api/admin/acquisition-stories/analysis')
        .set('X-Trustroots-Request', '1')
        .expect(404);
    } finally {
      await utils.signOut(agent);
    }
  });
});
