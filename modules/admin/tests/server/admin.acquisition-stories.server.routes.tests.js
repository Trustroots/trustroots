const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

describe('Admin acquisition stories CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  // Variation on stories to catch
  const acquisitionStories = [
    '123', // Test ignoring numbers
    'Google', // Test conversion to lowercase
    'facebook',
    'googling', // Test synonym
    'googl', // test Levenshtein distance test
    'singles', // Test conversion from plural to singulara
    'ws', // Test synonyms
    'warmshower',
    'www.warmshowers.com',
    'warm showers', // Test combound misspelling
    'something else ... :)', // Should capture only two terms and ignore rest
    'example.org', // Url normalization to "example"
    'http://example.org', // Url normalization to "example"
    'www example org', // Ignore www and org
    'www.example.org', // Url normalization to "example"
  ];

  // Generate one user per story
  let users = utils.generateUsers(acquisitionStories.length);
  users[0].roles = ['user', 'admin'];

  // Apply acquisition stories one per user
  users = users.map((user, i) => {
    user.acquisitionStory = acquisitionStories[i];
    return user;
  });

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

        body.length.should.equal(users.length);
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

        body.table.should.match([
          {
            category: 'example',
            observed: 4,
            percentage: 26.6667,
            expected: 2.1429,
          },
          {
            category: 'warmshowers',
            observed: 4,
            percentage: 26.6667,
            expected: 2.1429,
          },
          { category: 'google', observed: 3, percentage: 20, expected: 2.1429 },
          {
            category: 'something',
            observed: 1,
            percentage: 6.6667,
            expected: 2.1429,
          },
          {
            category: 'else',
            observed: 1,
            percentage: 6.6667,
            expected: 2.1429,
          },
          {
            category: 'single',
            observed: 1,
            percentage: 6.6667,
            expected: 2.1429,
          },
          {
            category: 'facebook',
            observed: 1,
            percentage: 6.6667,
            expected: 2.1429,
          },
        ]);
        body.size.should.be.Number();
        body.sum.should.be.Number();
        body.x2.should.be.Number();
        body.df.should.be.Number();
        body.entropy.should.be.Number();
      });
    });
  });
});
