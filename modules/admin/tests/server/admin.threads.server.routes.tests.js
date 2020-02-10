const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const Thread = mongoose.model('Thread');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
require('should');

/**
 * Globals
 */
let userRegular1Id;
let userRegular2Id;

describe('Admin Thread CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _users = utils.generateUsers(3);
  _users[0].roles = ['user', 'admin'];

  const credentialsAdmin = {
    username: _users[0].username,
    password: _users[0].password,
  };

  const credentialsRegular = {
    username: _users[1].username,
    password: _users[1].password,
  };

  beforeEach(async () => {
    await utils.saveUsers(_users);
  });

  afterEach(utils.clearDatabase);

  beforeEach(async () => {
    const message1 = new Thread({
      content: 'test',
      notificationCount: 0,
      userFrom: userRegular1Id,
      userTo: userRegular2Id,
    });

    const message2 = new Thread({
      content: 'test',
      notificationCount: 0,
      userFrom: userRegular2Id,
      userTo: userRegular1Id,
    });

    await message1.save();
    await message2.save();
  });

  describe('Read user\'s threads', () => {
    it('non-authenticated users should not be allowed to read threads', (done) => {
      agent.post('/api/admin/threads')
        .send({ 'userId': _users[1]._id })
        .expect(403)
        .end((err, res) => {
          res.body.message.should.equal('Forbidden.');
          return done(err);
        });
    });

    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });

      it('non-admin users should not be allowed to read threads', async () => {
        await utils.signIn(credentialsRegular, agent);

        const { body } = await agent.post('/api/admin/threads')
          .send({ 'userId': _users[1]._id })
          .expect(403);

        body.message.should.equal('Forbidden.');
      });

      it('admin users should be allowed to read threads', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent.post('/api/admin/threads')
          .send({ 'userId': _users[1]._id })
          .expect(200);

        // body.length.should.equal(2);
        console.log(body); //eslint-disable-line
        // body[0].userFrom.username.should.equal('user-regular1');
      });
    });
  });
});
