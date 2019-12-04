const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const sinon = require('sinon');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const express = require(path.resolve('./config/lib/express'));

const url = '/api/users/me';

/**
 * Use case: On React app startup, find out if user is signed in and who she is
 */

describe(`Read user's own profile: GET ${url}`, () => {
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _usersPublic = utils.generateUsers(3, { public: true });
  const _usersPrivate = utils.generateUsers(1, { public: false, username: 'private', email: 'non@example.com' });
  const _users = [..._usersPublic, ..._usersPrivate];

  let users;

  beforeEach(() => {
    sinon.useFakeTimers({ now: new Date('2019-01-13 13:21:55.1'), toFake: ['Date'] });
  });

  afterEach(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    users = await utils.saveUsers(_users);
  });

  afterEach(utils.clearDatabase);
  afterEach(async () => await utils.signOut(agent));

  context('logged in', () => {
    beforeEach(async () => await utils.signIn(_usersPublic[0], agent));

    it('read logged user\'s profile', async () => {
      const { body } = await agent
        .get(url)
        .expect(200);

      should(body.username).eql(users[0].username);
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(async () => await utils.signIn(_usersPrivate[0], agent));

    it('200', async () => {
      await agent
        .get(url)
        .expect(200);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent
        .get(url)
        .expect(403);
    });
  });
});
