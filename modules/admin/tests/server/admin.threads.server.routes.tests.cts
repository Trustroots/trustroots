import type { Application } from 'express';
import type {
  ThreadModel,
  ThreadRecord,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';

const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const Thread = mongoose.model<ThreadRecord, ThreadModel>('Thread');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');
describe('Admin Thread CRUD tests', () => {
  let app: Application;
  let agent: ReturnType<typeof request.agent>;
  let users: UserDocument[];
  let userRegular1Id: UserDocument['_id'];
  let userRegular2Id: UserDocument['_id'];

  before(async function () {
    app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // Get application
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
    users = await utils.saveUsers(_usersRaw);
    userRegular1Id = users[1]._id;
    userRegular2Id = users[2]._id;
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
  describe("Read user's threads", () => {
    it('non-authenticated users should not be allowed to read threads', (done: Mocha.Done) => {
      agent
        .post('/api/admin/threads')
        .send({
          userId: userRegular1Id,
        })
        .expect(403)
        .end((err: Error | null, res: import('supertest').Response) => {
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
        const { body } = await agent
          .post('/api/admin/threads')
          .send({
            userId: userRegular1Id,
          })
          .expect(403);
        body.message.should.equal('Forbidden.');
      });
      it('admin users should be allowed to read threads by user ID', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/threads')
          .send({
            userId: userRegular1Id,
          })
          .expect(200);
        body.length.should.equal(2);
        body[0].userToProfile[0]._id.should.equalOneOf([
          users[1]._id.toString(),
          users[2]._id.toString(),
        ]);
      });
      it('admin users should get an error for an invalid user ID', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/threads')
          .send({
            userId: 'not-a-valid-id',
          })
          .expect(400);
        body.message.should.equal('Cannot interpret id.');
      });
      it('admin users should get an error when no user is provided', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/threads')
          .send({})
          .expect(400);
        body.message.should.equal('Cannot interpret id.');
      });
      it('admin users should be allowed to read threads by username', async () => {
        await utils.signInPrivileged(credentialsAdmin, agent);
        const { body } = await agent
          .post('/api/admin/threads')
          .send({
            username: _usersRaw[1].username,
          })
          .expect(200);
        body.length.should.equal(2);
        body[0].userToProfile[0].username.should.equalOneOf([
          users[1].username,
          users[2].username,
        ]);
      });
    });
  });
});
