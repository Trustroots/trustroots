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

  let users;
  let userRegular1Id;
  let userRegular2Id;

  const _users = utils.generateUsers(3);
  _users[0].roles = ['user', 'admin'];

  beforeEach(async () => {
    users = await utils.saveUsers(_users);
    userRegular1Id = users[1]._id;
    userRegular2Id = users[2]._id;

    const referenceBase = {
      created: new Date(),
      // eslint-disable-next-line new-cap
      thread: mongoose.Types.ObjectId().toString(),
    };

    const reference1 = new ReferenceThread({
      ...referenceBase,
      reference: 'yes',
      userFrom: userRegular1Id,
      userTo: userRegular2Id,
    });

    const reference2 = new ReferenceThread({
      ...referenceBase,
      reference: 'no',
      userFrom: userRegular2Id,
      userTo: userRegular1Id,
    });

    await reference1.save();
    await reference2.save();
  });

  afterEach(utils.clearDatabase);

  describe('Read reference threads', () => {
    it('non-authenticated users should not be allowed to read reference threads', async () => {
      const { body } = await agent
        .get('/api/admin/reference-threads')
        .expect(403);

      body.message.should.equal('Forbidden.');
    });

    describe('As authenticated user...', () => {
      afterEach(async () => {
        await utils.signOut(agent);
      });

      it('non-admin users should not be allowed to read reference threads', async () => {
        await utils.signIn(_users[1], agent);

        const { body } = await agent
          .get('/api/admin/reference-threads')
          .expect(403);

        body.message.should.equal('Forbidden.');
      });

      it('admin users should be allowed to read reference threads', async () => {
        await utils.signIn(_users[0], agent);

        const { body } = await agent
          .get('/api/admin/reference-threads')
          .expect(200);

        // Should contain only "no" references
        body.length.should.equal(1);
        body[0].reference.should.equal('no');
      });
    });
  });
});
