const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
require('should');

const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const ReferenceThread = mongoose.model('ReferenceThread');

describe('Admin Reference thread CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  let _users;
  let userRegular1Id;
  let userRegular2Id;

  const _usersRaw = utils.generateUsers(3);
  _usersRaw[0].roles = ['user', 'admin'];

  const credentialsAdmin = {
    username: _usersRaw[0].username,
    password: _usersRaw[0].password,
  };

  const credentialsRegular = {
    username: _usersRaw[1].username,
    password: _usersRaw[1].password,
  };

  beforeEach(async () => {
    _users = await utils.saveUsers(_usersRaw);
    userRegular1Id = _users[1]._id;
    userRegular2Id = _users[2]._id;
  });

  afterEach(utils.clearDatabase);

  beforeEach(async () => {
    const reference1 = new ReferenceThread({
      reference: 'yes',
      created: new Date(),
      userFrom: userRegular1Id,
      userTo: userRegular2Id,
    });

    const reference2 = new ReferenceThread({
      reference: 'no',
      created: new Date(),
      userFrom: userRegular2Id,
      userTo: userRegular1Id,
    });

    await reference1.save();
    await reference2.save();
  });

  describe('Read reference threads', () => {
    it('non-authenticated users should not be allowed to read reference threads', async () => {
      const { body } = agent.get('/api/admin/reference-threads').expect(403);

      body.message.should.equal('Forbidden.');
    });

    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });

      it('non-admin users should not be allowed to read reference threads', async () => {
        await utils.signIn(credentialsRegular, agent);

        const { body } = await agent
          .get('/api/admin/reference-threads')
          .expect(403);

        body.message.should.equal('Forbidden.');
      });

      it('admin users should be allowed to read reference threads', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .get('/api/admin/reference-threads')
          .expect(200);

        body.length.should.equal(1);
        body[0].reference.should.equal('no');
      });
    });
  });
});
