const mongoose = require('mongoose');
const path = require('path');
const should = require('should');
const request = require('supertest');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const express = require(path.resolve('./config/lib/express'));

describe('Read count of experiences received by user', () => {
  // GET /experiences/count?userTo=:UserId

  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  let users;

  const _usersPublic = utils.generateUsers(6, { public: true });
  const _usersPrivate = utils.generateUsers(3, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com',
  });
  const _users = [..._usersPublic, ..._usersPrivate];

  /**
   * array of [userFrom, userTo, values]
   *
   * Overview of the experienceData
   * - row: userFrom - index of user within array of users provided to utils.generateExperiences()
   * - column: userTo - same as row
   * - T: experience exists and is public
   * - F: experience exists and is not public
   * - .: experience doesn't exist
   *
   *   0 1 2 3 4 5
   * 0 . T T F F T
   * 1 T . T T . T
   * 2 T . . T F T
   * 3 T . F . . .
   * 4 F . . . . .
   * 5 T . . . . .
   */
  const experienceData = [
    [0, 1],
    [0, 2],
    [0, 3, { public: false }],
    [0, 4, { public: false }],
    [0, 5],
    [1, 0],
    [1, 2],
    [1, 3],
    [1, 5],
    [2, 0],
    [2, 3],
    [2, 4, { public: false }],
    [2, 5],
    [3, 0],
    [3, 2, { public: false }],
    [4, 0, { public: false }],
    [5, 0],
  ];

  before(async () => {
    users = await utils.saveUsers(_users);

    const _experiences = utils.generateExperiences(users, experienceData);
    await utils.saveExperiences(_experiences);
  });

  after(utils.clearDatabase);

  context('logged in as public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('respond with all public experiences to userTo', async () => {
      const { body } = await agent
        .get(`/api/experiences/count?userTo=${users[2]._id}`)
        .expect(200);

      // user2 has received 2 public and 1 non-public experience
      body.count.should.equal(2);
      should.not.exist(body.hasPending);
    });

    it('private experiences are included when own profile', async () => {
      const { body } = await agent
        .get(`/api/experiences/count?userTo=${users[0]._id}`)
        .expect(200);

      body.count.should.equal(5);
      body.hasPending.should.be.true();
    });

    it('[no params] 400 and error', async () => {
      const { body } = await agent.get('/api/experiences/count').expect(400);

      body.message.should.equal('Missing or invalid `userTo` request param');
    });

    it('[invalid params] 400 and error', async () => {
      const { body } = await agent
        .get('/api/experiences/count?userTo=1')
        .expect(400);

      body.message.should.equal('Missing or invalid `userTo` request param');
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent
        .get(`/api/experiences/count?userTo=${users[2]._id}`)
        .expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent
        .get(`/api/experiences/count?userTo=${users[2]._id}`)
        .expect(403);
    });
  });
});
