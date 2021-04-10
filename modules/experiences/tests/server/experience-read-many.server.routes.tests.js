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

describe('Read experiences by userTo Id', () => {
  // GET /experiences?userFrom=:UserId&userTo=:UserId

  // logged in public user can read all public experiences by userTo
  // ...                   can read all public and private experiences to self
  // ...                   can not read private experiences to self
  // when userFrom or userTo doesn't exist, we simply return empty list
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

  beforeEach(() => {
    sinon.useFakeTimers({ now: new Date('2018-01-12'), toFake: ['Date'] });
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
   *   0 1 2 3 4 5
   * 0 . T T F . .
   * 1 T . T F . .
   * 2 . . . . . .
   * 3 . . . . . .
   * 4 T T . . . .
   * 5 F F . . . .
   */
  const experienceData = [
    [0, 1],
    [0, 2],
    [0, 3, { public: false }],
    [1, 0],
    [1, 2],
    [1, 3, { public: false }],
    [4, 0],
    [4, 1],
    [5, 0, { public: false }],
    [5, 1, { public: false }],
  ];

  beforeEach(async () => {
    const _experiences = utils.generateExperiences(users, experienceData);

    await utils.saveExperiences(_experiences);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userTo] respond with all public experiences to userTo', async () => {
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[1]._id}`)
        .expect(200);

      // user0 and user4 shared public experiencdes with user1,
      // private experiences are not returned
      should(body).be.Array().of.length(2);
    });

    it('the experiences in response have expected structure, userFrom & userTo have miniProfile', async () => {
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[1]._id}`)
        .expect(200);

      for (const ref of body) {
        should(ref)
          .have.property('userFrom')
          .which.is.Object()
          .with.properties(
            userProfile.userMiniProfileFields.split(' ').slice(2, -1),
          );

        should(ref)
          .have.property('userTo')
          .which.is.Object()
          .with.properties(
            userProfile.userMiniProfileFields.split(' ').slice(2, -1),
          );

        should(ref).have.propertyByPath('interactions', 'met').Boolean();
        should(ref).have.propertyByPath('interactions', 'guest').Boolean();
        should(ref).have.propertyByPath('interactions', 'host').Boolean();
        should(ref).have.property('public', true);
        should(ref).have.property('created', new Date().toISOString());
        should(ref)
          .have.property('recommend')
          .which.is.equalOneOf(['no', 'yes', 'unknown']);
        should(ref)
          .have.property('_id')
          .String()
          .match(/[0-9a-f]{24}/);
      }

      const response = body[0].response;
      should(response).have.property('created', new Date().toISOString());
      should(response).have.propertyByPath('interactions', 'met').Boolean();
      should(response).have.propertyByPath('interactions', 'guest').Boolean();
      should(response).have.propertyByPath('interactions', 'host').Boolean();
      should(response)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);

      should(body[1].response).eql(null);

      should(body[0].userTo._id).eql(users[1].id);
      should(body[1].userTo._id).eql(users[1].id);

      should(body[0].userFrom._id).eql(users[0].id);
      should(body[1].userFrom._id).eql(users[4].id);
    });

    it('[param userTo] userTo is self, respond with all public and pending experiences to userTo', async () => {
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[0]._id}`)
        .expect(200);

      // user1 and user4 shared public experiences, user5 shared a private one
      should(body).be.Array().of.length(3);
    });

    it('userTo is self, private experience has only limited fields', async () => {
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[0]._id}`)
        .expect(200);

      for (const ref of [body[0], body[1]]) {
        should(ref).have.properties(
          '_id',
          'userFrom',
          'userTo',
          'public',
          'created',
          'recommend',
          'response',
        );

        should(ref).have.propertyByPath('interactions', 'met');
        should(ref).have.propertyByPath('interactions', 'guest');
        should(ref).have.propertyByPath('interactions', 'host');
      }

      should(body[2]).have.only.properties(
        '_id',
        'userFrom',
        'userTo',
        'public',
        'created',
        'response',
      );

      should(body[0]).have.property('response').not.eql(null);
      should(body[1].response).eql(null);
      should(body[2].response).eql(null);

      should(body[0].userTo._id).eql(users[0].id);
      should(body[1].userTo._id).eql(users[0].id);
      should(body[2].userTo._id).eql(users[0].id);

      should(body[0].userFrom._id).eql(users[1].id);
      should(body[1].userFrom._id).eql(users[4].id);
      should(body[2].userFrom._id).eql(users[5].id);
    });

    it('[param userTo] response should contain private experience from self', async () => {
      const { body } = await agent
        .get(`/api/experiences?userTo=${users[3]._id}`)
        .expect(200);

      should(body[0].userFrom._id).eql(users[0].id);
      should(body[0].userTo._id).eql(users[3].id);

      should(body[0].response).be.null();
      should(body[0].public).be.false();

      should(body[0]).have.properties(
        '_id',
        'created',
        'recommend',
        'interactions',
      );
    });

    it('[no params] 400 and error', async () => {
      const { body } = await agent.get('/api/experiences').expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          userTo: 'missing',
        },
      });
    });

    it('[invalid params] 400 and error', async () => {
      const { body } = await agent.get('/api/experiences?userTo=1').expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          userTo: 'invalid',
        },
      });
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent.get(`/api/experiences?userTo=${users[2]._id}`).expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent.get(`/api/experiences?userTo=${users[2]._id}`).expect(403);
    });
  });
});
