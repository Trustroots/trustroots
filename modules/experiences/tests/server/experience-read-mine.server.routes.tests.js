const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const sinon = require('sinon');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const express = require(path.resolve('./config/lib/express'));

describe('Read my experience to userTo Id', () => {
  // GET /my-experience&userTo=:UserId

  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  let users;

  const _usersPublic = utils.generateUsers(6, { public: true });
  const _usersPrivate = utils.generateUsers(1, {
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
   *   0 1 2 3 4 5 6
   * 0 . T T F . . .
   * 1 T
   * 2 .
   * 3 .
   * 4 T
   * 5 F
   * 6 .
   */
  const experienceData = [
    [0, 1],
    [0, 2],
    [0, 3, { public: false }],
    [1, 0],
    [4, 0],
    [5, 0, { public: false }],
  ];

  beforeEach(async () => {
    const _experiences = utils.generateExperiences(users, experienceData);

    await utils.saveExperiences(_experiences);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userWith] 1: user who has also shared experience', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[1]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'guest').Boolean();
      should(body).have.propertyByPath('interactions', 'host').Boolean();
      should(body).have.property('public', true);
      should(body).have.property('created', new Date().toISOString());
      should(body)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);
      should(body)
        .have.property('_id')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userFrom')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userTo')
        .String()
        .match(/[0-9a-f]{24}/);

      const response = body.response;
      should(response).have.propertyByPath('interactions', 'met').Boolean();
      should(response).have.propertyByPath('interactions', 'guest').Boolean();
      should(response).have.propertyByPath('interactions', 'host').Boolean();
      should(response).have.property('created', new Date().toISOString());
      should(response)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);
      should(response)
        .have.property('_id')
        .String()
        .match(/[0-9a-f]{24}/);
    });

    it('[param userWith] 2: user who did not share experience', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[2]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'guest').Boolean();
      should(body).have.propertyByPath('interactions', 'host').Boolean();
      should(body).have.property('public', true);
      should(body).have.property('created', new Date().toISOString());
      should(body)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);
      should(body)
        .have.property('_id')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userFrom')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userTo')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body.response).eql(null);
    });

    it('[param userWith] 3: experience is still private', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[3]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'guest').Boolean();
      should(body).have.propertyByPath('interactions', 'host').Boolean();
      should(body).have.property('public', false);
      should(body).have.property('created', new Date().toISOString());
      should(body)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);
      should(body)
        .have.property('_id')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userFrom')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body)
        .have.property('userTo')
        .String()
        .match(/[0-9a-f]{24}/);
      should(body.response).eql(null);
    });

    it("[param userWith] 4: experience was shared with me - i didn't share one (published)", async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[4]._id}`)
        .expect(200);

      should(body).have.property('public', true);

      should(body.userTo).eql(users[0].id);
      should(body.userFrom).eql(users[4].id);
      should(body.response).eql(null);
    });

    it("[param userWith] 5: experience was shared with me - i didn't share one (still private)", async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[5]._id}`)
        .expect(200);

      should(body).have.property('public', false);

      should(body.userTo).eql(users[0].id);
      should(body.userFrom).eql(users[5].id);
      should(body.response).eql(null);
    });

    it('[param userWith] 6: user with whom no experience shared', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[6]._id}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
      });
    });

    it('[param userTo] 0: myself', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userWith=${users[0]._id}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
      });
    });

    it('[no params] 400 and error', async () => {
      const { body } = await agent.get('/api/my-experience').expect(400);

      should(body).eql({
        message: 'Missing or invalid `userTo` request param',
      });
    });

    it('[invalid params] 400 and error', async () => {
      const { body } = await agent
        .get('/api/my-experience?userWith=asdf')
        .expect(400);

      should(body).eql({
        message: 'Missing or invalid `userTo` request param',
      });
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent
        .get(`/api/my-experience?userWith=${users[2]._id}`)
        .expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent
        .get(`/api/my-experience?userWith=${users[2]._id}`)
        .expect(403);
    });
  });
});
