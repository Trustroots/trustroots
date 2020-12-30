const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const sinon = require('sinon');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const express = require(path.resolve('./config/lib/express'));

describe('Read my reference to userTo Id', () => {
  // GET /my-reference&userTo=:UserId

  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  let users;

  const _usersPublic = utils.generateUsers(4, { public: true });
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
   * Overview of the referenceData
   * - row: userFrom - index of user within array of users provided to utils.generateReferences()
   * - column: userTo - same as row
   * - T: reference exists and is public
   * - F: reference exists and is not public
   * - .: reference doesn't exist
   *
   *   0 1 2 3 4
   * 0 . T T F .
   * 1 T
   * 2 .
   * 3 .
   * 4 .
   */
  const referenceData = [
    [0, 1],
    [0, 2],
    [0, 3, { public: false }],
    [1, 0],
  ];

  beforeEach(async () => {
    const _references = utils.generateReferences(users, referenceData);

    await utils.saveReferences(_references);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userTo] 1: user who has also shared experience', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userTo=${users[1]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedMe').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedThem').Boolean();
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
      should(response)
        .have.propertyByPath('interactions', 'hostedMe')
        .Boolean();
      should(response)
        .have.propertyByPath('interactions', 'hostedThem')
        .Boolean();
      should(response).have.property('created', new Date().toISOString());
      should(response)
        .have.property('recommend')
        .which.is.equalOneOf(['no', 'yes', 'unknown']);
      should(response)
        .have.property('_id')
        .String()
        .match(/[0-9a-f]{24}/);
    });

    it('[param userTo] 2: user who did not share experience', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userTo=${users[2]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedMe').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedThem').Boolean();
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

    it('[param userTo] 3: experience is still private', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userTo=${users[3]._id}`)
        .expect(200);

      should(body).have.propertyByPath('interactions', 'met').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedMe').Boolean();
      should(body).have.propertyByPath('interactions', 'hostedThem').Boolean();
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

    it('[param userTo] 4: user with whom no experience shared', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userTo=${users[4]._id}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
      });
    });

    it('[param userTo] 0: myself', async () => {
      const { body } = await agent
        .get(`/api/my-experience?userTo=${users[4]._id}`)
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
        .get('/api/my-experience?userTo=asdf')
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
      await agent.get(`/api/my-experience?userTo=${users[2]._id}`).expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent.get(`/api/my-experience?userTo=${users[2]._id}`).expect(403);
    });
  });
});
