const _ = require('lodash');
const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const sinon = require('sinon');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const express = require(path.resolve('./config/lib/express'));

describe('Read a single experience by experience id', () => {
  // GET /experiences/:experienceId
  // logged in public user can read a single public experience by id
  // .....                 can read a single private experience if it is from self
  // logged in public user can not read other private experiences
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _usersPublic = utils.generateUsers(4, { public: true });
  const _usersPrivate = utils.generateUsers(1, {
    public: false,
    username: 'private',
    email: 'non@example.com',
  });
  const _users = [..._usersPublic, ..._usersPrivate];

  let users;
  let experiences;

  beforeEach(() => {
    sinon.useFakeTimers({
      now: new Date('2019-01-13 13:21:55.1'),
      toFake: ['Date'],
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    users = await utils.saveUsers(_users);
  });

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
   *   0 1 2 3
   * 0 . . F T
   * 1 F . T .
   * 2 . T . .
   * 3 . F . .
   */
  const experienceData = [
    [0, 3],
    [0, 2, { public: false }],
    [1, 0, { public: false }],
    [1, 2],
    [2, 1],
    [3, 1, { public: false }],
  ];

  beforeEach(async () => {
    const _experiences = utils.generateExperiences(users, experienceData);
    experiences = await utils.saveExperiences(_experiences);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('read a single public experience by id that has response', async () => {
      const { body } = await agent
        .get(`/api/experiences/${experiences[3]._id}`)
        .expect(200);

      // pre-collect expected values of users
      const userFields = userProfile.userMiniProfileFields.split(' ').slice(2);
      const userFromExp = _.pick(users[1], userFields);
      userFromExp._id = users[1]._id.toString();
      const userToExp = _.pick(users[2], userFields);
      userToExp._id = users[2]._id.toString();

      should(body).eql({
        public: true,
        userFrom: userFromExp,
        userTo: userToExp,
        created: new Date().toISOString(),
        _id: experiences[3]._id.toString(),
        recommend: experiences[3].recommend,
        interactions: {
          met: experiences[3].interactions.met,
          guest: experiences[3].interactions.guest,
          host: experiences[3].interactions.host,
        },
        response: {
          _id: experiences[4]._id.toString(),
          created: new Date().toISOString(),
          recommend: experiences[4].recommend,
          interactions: {
            met: experiences[4].interactions.met,
            guest: experiences[4].interactions.guest,
            host: experiences[4].interactions.host,
          },
        },
      });
    });

    it('read a single private experience if it is from self', async () => {
      const { body } = await agent
        .get(`/api/experiences/${experiences[1]._id}`)
        .expect(200);

      should(body).match({
        public: false,
        _id: experiences[1]._id.toString(),
        response: null,
      });
    });

    it('[private experience to self] display in limited form', async () => {
      const { body } = await agent
        .get(`/api/experiences/${experiences[2]._id}`)
        .expect(200);

      should(body).match({
        public: false,
        _id: experiences[2]._id.toString(),
        created: new Date().toISOString(),
        response: null,
      });

      should(body).have.only.keys(
        'userFrom',
        'userTo',
        '_id',
        'public',
        'created',
        'response',
      );
    });

    it('[private experiences not from self] 404', async () => {
      const { body } = await agent
        .get(`/api/experiences/${experiences[5]._id}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
        details: {
          experience: 'not found',
        },
      });
    });

    it("[experience doesn't exist] 404", async () => {
      const { body } = await agent
        .get(`/api/experiences/${'a'.repeat(24)}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
        details: {
          experience: 'not found',
        },
      });
    });

    it('[invalid experienceId] 400', async () => {
      const { body } = await agent.get('/api/experiences/foo').expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          experienceId: 'invalid',
        },
      });
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent.get(`/api/experiences/${experiences[3]._id}`).expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent.get(`/api/experiences/${experiences[3]._id}`).expect(403);
    });
  });
});
