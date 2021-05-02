const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

describe('Admin acquisition stories CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const users = utils.generateUsers(5);
  users[0].roles = ['user', 'admin'];
  users[0].acquisitionStory = 'google';
  users[1].acquisitionStory = 'facebook';
  users[2].acquisitionStory = 'googling';
  users[3].acquisitionStory = 'googl';
  users[4].acquisitionStory = 'something else ... :)';

  before(async () => {
    await utils.saveUsers(users);
  });

  after(utils.clearDatabase);

  describe('Acquisition stories', () => {
    it('non-authenticated users should not be allowed to read acquisition stories', async () => {
      await agent.post('/api/admin/acquisition-stories').expect(403);
    });

    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });

      it('non-admin users should not be allowed to read acquisition stories', async () => {
        await utils.signIn(users[1], agent);
        await agent.post('/api/admin/acquisition-stories').expect(403);
      });

      it('admin users should be allowed to read acquisition stories', async () => {
        await utils.signIn(users[0], agent);
        const { body } = await agent
          .post('/api/admin/acquisition-stories')
          .expect(200);

        body.length.should.equal(5);
      });
    });
  });

  describe('Acquisition stories analysis', () => {
    it('non-authenticated users should not be allowed to read acquisition stories analysis', async () => {
      await agent.post('/api/admin/acquisition-stories/analysis').expect(403);
    });

    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });

      it('non-admin users should not be allowed to read acquisition stories analysis', async () => {
        await utils.signIn(users[1], agent);
        await agent.post('/api/admin/acquisition-stories/analysis').expect(403);
      });

      it('admin users should be allowed to read acquisition stories analysis and analysis have certain shape', async () => {
        await utils.signIn(users[0], agent);
        const { body } = await agent
          .post('/api/admin/acquisition-stories/analysis')
          .expect(200);

        body.table.length.should.equal(4);
        body.table[0].category.should.equal('google');
        body.table[0].observed.should.equal(3);
        body.table[0].percentage.should.equal(50);
        body.table[0].expected.should.equal(1.5);
        body.size.should.equal(4);
        body.sum.should.equal(6);
        body.x2.should.equal(2);
        body.df.should.equal(3);
        body.entropy.should.equal(1.7925);
      });
    });
  });
});
