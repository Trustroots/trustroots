const sinon = require('sinon');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
type TestExpressModule =
  import('../../../../testutils/server/model-contracts.mts').TestExpressModule;
type TestAgent =
  import('../../../../testutils/server/model-contracts.mts').TestAgent;
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const should: typeof import('should') = require('should');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type ReferenceThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ReferenceThreadRecord;
type ThreadRecord =
  import('../../../../testutils/server/model-contracts.mts').ThreadRecord;
const Message = mongoose.model<MessageRecord>('Message');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const Thread = mongoose.model<ThreadRecord>('Thread');
const User = mongoose.model<UserRecord>('User');
type ThreadBulkOperations = Parameters<typeof Thread.bulkWrite>[0];
type ThreadBulkOptions = Parameters<typeof Thread.bulkWrite>[1];

/**
 * Globals
 */
let app: import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
let agent: TestAgent;
let credentialsAdmin: { username: string; password: string };
let credentialsRegular: { username: string; password: string };
let userAdmin: InstanceType<typeof User>;
let userRegular1: InstanceType<typeof User>;
let userRegular2: InstanceType<typeof User>;
let userRegular1Id: import('mongoose').Types.ObjectId | string;
let userRegular2Id: import('mongoose').Types.ObjectId | string;
describe('Admin Message CRUD tests', () => {
  before(done => {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(async () => {
    try {
      // Create admin credentials
      credentialsAdmin = {
        username: 'useradmin',
        password: 'Password123!',
      };

      // Create regular user credentials
      credentialsRegular = {
        username: 'userregular1',
        password: 'Password123!',
      };

      // Create a new admin user
      userAdmin = new User({
        displayName: 'Admin Name',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'Name',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user', 'admin'],
        ...credentialsAdmin,
      });
      await userAdmin.save();

      // Create a new regular user
      userRegular1 = new User({
        displayName: 'Full Name1',
        email: 'regular1@example.com',
        firstName: 'Full',
        lastName: 'Name2',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user'],
        ...credentialsRegular,
      });

      // Create a new regular user
      userRegular2 = new User({
        displayName: 'Full Name2',
        email: 'regular2@example.com',
        firstName: 'Full',
        lastName: 'Name2',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user'],
        username: 'userregular2',
        password: 'Password123!',
      });
      const { _id: _userRegular1Id } = await userRegular1.save();
      const { _id: _userRegular2Id } = await userRegular2.save();
      userRegular1Id = _userRegular1Id;
      userRegular2Id = _userRegular2Id;
      const message1 = new Message({
        content: 'test',
        created: new Date('2026-06-01T10:00:00.000Z'),
        notificationCount: 0,
        userFrom: userRegular1Id,
        userTo: userRegular2Id,
      });
      const message2 = new Message({
        content: 'test',
        created: new Date('2026-06-01T10:01:00.000Z'),
        notificationCount: 0,
        userFrom: userRegular2Id,
        userTo: userRegular1Id,
      });
      await message1.save();
      await message2.save();
      await new ReferenceThread({
        reference: 'yes',
        thread: new mongoose.Types.ObjectId(),
        userFrom: userRegular1Id,
        userTo: userRegular2Id,
      }).save();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });
  afterEach(utils.clearDatabase);
  describe('Read messages between two users', () => {
    it('non-authenticated users should not be allowed to read messages', done => {
      agent
        .post('/api/admin/messages')
        .send({
          user1: userRegular1Id,
          user2: userRegular2Id,
        })
        .expect(403)
        .end((err, res) => {
          res.body.message.should.equal('Forbidden.');
          return done(err);
        });
    });
    it('non-admin users should not be allowed to read messages', done => {
      agent
        .post('/api/auth/signin')
        .send(credentialsRegular)
        .expect(200)
        .end(signinErr => {
          if (signinErr) {
            return done(signinErr);
          }
          agent
            .post('/api/admin/messages')
            .send({
              user1: userRegular1Id,
              user2: userRegular2Id,
            })
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });
    it('admin users should be allowed to read messages', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      await utils.elevateAdminAccess(agent, credentialsAdmin.password);
      await new Message({
        content: 'unrelated conversation',
        created: new Date('2026-06-01T09:00:00.000Z'),
        userFrom: userAdmin._id,
        userTo: userRegular1Id,
      }).save();
      const { body } = await agent
        .post('/api/admin/messages')
        .send({
          user1: userRegular1Id,
          user2: userRegular2Id,
        })
        .expect(200);
      body.messages.length.should.equal(2);
      body.messages[0].userFrom.username.should.equal('userregular1');
      body.messages[0].userTo.username.should.equal('userregular2');
      body.referenceThreads.length.should.equal(1);
      body.referenceThreads[0].reference.should.equal('yes');
      body.referenceThreads[0].userFrom.username.should.equal('userregular1');
      body.referenceThreads[0].userTo.username.should.equal('userregular2');
    });
  });
  describe('Warn scammer recipients', () => {
    it('lists distinct existing recipients contacted by a username', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      await new Message({
        content: 'another message',
        userFrom: userRegular1Id,
        userTo: userRegular2Id,
      }).save();
      await new Message({
        content: 'message to the administrator',
        userFrom: userRegular1Id,
        userTo: userAdmin._id,
      }).save();
      const { body } = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({
          username: userRegular1.username,
        })
        .expect(200);
      body.scammer.username.should.equal(userRegular1.username);
      body.recipients.length.should.equal(1);
      body.recipients[0].username.should.equal(userRegular2.username);
    });
    it('sends a sanitised warning and updates the recipient thread', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const { body } = await agent
        .post('/api/admin/messages/scammer-warning')
        .send({
          username: userRegular1.username,
          requestId: '11111111111141118111111111111111',
          content: '<p>Ignore this scam.</p><script>unsafe()</script>',
        })
        .expect(200);
      body.sent.should.equal(1);
      const warning = await Message.findOne({
        userFrom: userAdmin._id,
        userTo: userRegular2Id,
      }).exec();
      if (!warning) throw new Error('Expected saved warning message');
      should(warning.content).equal('<p>Ignore this scam.</p>');
      const thread = await Thread.findOne({
        message: warning._id,
      }).exec();
      if (!thread) throw new Error('Expected warning thread');
      String(thread.userFrom).should.equal(String(userAdmin._id));
      String(thread.userTo).should.equal(String(userRegular2Id));
      should(thread.read).equal(false);
    });
    it('repairs a partial delivery without duplicating messages or resetting read state', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const payload = {
        username: userRegular1.username,
        content: 'Please ignore the earlier message.',
        requestId: '22222222222242228222222222222222',
      };
      const bulkWrite = sinon
        .stub(Thread, 'bulkWrite')
        .rejects(new Error('Temporary thread write failure'));
      try {
        await agent
          .post('/api/admin/messages/scammer-warning')
          .send(payload)
          .expect(400);
      } finally {
        bulkWrite.restore();
      }
      const filter = {
        userFrom: userAdmin._id,
        userTo: userRegular2Id,
      };
      (await Message.countDocuments(filter)).should.equal(1);
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send(payload)
        .expect(200);
      const message = await Message.findOne(filter);
      if (!message) throw new Error('Expected retry warning message');
      (await Message.countDocuments(filter)).should.equal(1);
      const thread = await Thread.findOne({
        message: message._id,
      });
      should.exist(thread);
      if (!thread) throw new Error('Expected retry warning thread');
      await Message.updateOne(
        {
          _id: message._id,
        },
        {
          $set: {
            read: true,
          },
        },
      );
      await Thread.updateOne(
        {
          _id: thread._id,
        },
        {
          $set: {
            read: true,
          },
        },
      );
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send(payload)
        .expect(200);
      should((await Message.findById(message._id))?.read).equal(true);
      should((await Thread.findById(thread._id))?.read).equal(true);
      (await Message.countDocuments(filter)).should.equal(1);
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send({
          ...payload,
          requestId: '33333333333343338333333333333333',
        })
        .expect(200);
      (await Message.countDocuments(filter)).should.equal(2);
    });
    it('requires a valid request ID before saving warning messages', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      for (const requestId of [undefined, 'invalid']) {
        await agent
          .post('/api/admin/messages/scammer-warning')
          .send({
            username: userRegular1.username,
            content: 'Safety warning',
            requestId,
          })
          .expect(400);
      }
      (
        await Message.countDocuments({
          userFrom: userAdmin._id,
        })
      ).should.equal(0);
    });
    it('keeps one inbox thread when warning retries overlap', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const payload = {
        username: userRegular1.username,
        content: 'Please ignore the earlier message.',
        requestId: '44444444444444444444444444444444',
      };
      const send = () =>
        agent
          .post('/api/admin/messages/scammer-warning')
          .send(payload)
          .expect(200);
      await send();
      // Model the state after messages were saved but thread creation failed.
      await Thread.deleteMany({});
      const originalBulkWrite = Thread.bulkWrite;
      const retries = 20;
      let waiting = 0;
      let release: () => void = () => {
        throw new Error('Retry barrier has not been initialised');
      };
      const barrier = new Promise<void>(resolve => {
        release = resolve;
      });
      const bulkWrite = sinon
        .stub(Thread, 'bulkWrite')
        .callsFake(
          async (writes: ThreadBulkOperations, options?: ThreadBulkOptions) => {
            if (++waiting === retries) release();
            await barrier;
            return originalBulkWrite.call(Thread, writes, options);
          },
        );
      try {
        await Promise.all(
          Array.from(
            {
              length: retries,
            },
            send,
          ),
        );
      } finally {
        bulkWrite.restore();
      }
      (
        await Message.countDocuments({
          userFrom: userAdmin._id,
        })
      ).should.equal(1);
      (await Thread.countDocuments({})).should.equal(1);
    });
    it('repairs a thread after another warning request wins the insert race', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const originalBulkWrite = Thread.bulkWrite;
      const bulkWrite = sinon.stub(Thread, 'bulkWrite');
      bulkWrite.onFirstCall().rejects(
        Object.assign(new Error('Concurrent insert'), {
          code: 11000,
        }),
      );
      bulkWrite
        .onSecondCall()
        .callsFake(
          (writes: ThreadBulkOperations, options?: ThreadBulkOptions) => {
            return originalBulkWrite.call(Thread, writes, options);
          },
        );
      try {
        await agent
          .post('/api/admin/messages/scammer-warning')
          .send({
            username: userRegular1.username,
            content: 'Safety warning',
            requestId: '55555555555555555555555555555555',
          })
          .expect(200);
        bulkWrite.callCount.should.equal(2);
        (await Thread.countDocuments({})).should.equal(1);
      } finally {
        bulkWrite.restore();
      }
    });
    it('updates an existing reverse-direction thread and preserves a newer reply on retry', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const oldThread = await Thread.create({
        userFrom: userRegular2Id,
        userTo: userAdmin._id,
        updated: new Date('2026-01-01T00:00:00Z'),
        read: true,
      });
      const payload = {
        username: userRegular1.username,
        content: 'Safety warning',
        requestId: '66666666666666666666666666666666',
      };
      const send = () =>
        agent
          .post('/api/admin/messages/scammer-warning')
          .send(payload)
          .expect(200);
      await send();
      const warning = await Message.findOne({
        userFrom: userAdmin._id,
      });
      if (!warning) throw new Error('Expected saved warning message');
      if (!(warning.created instanceof Date)) {
        throw new Error('Expected warning creation timestamp');
      }
      const updatedThread = await Thread.findById(oldThread._id);
      if (!updatedThread) throw new Error('Expected updated thread');
      String(updatedThread.message).should.equal(warning._id.toString());
      should(updatedThread.read).equal(false);
      const reply = await Message.create({
        userFrom: userRegular2Id,
        userTo: userAdmin._id,
        content: 'Thanks for the warning.',
        created: new Date(warning.created.getTime() + 1000),
      });
      await Thread.updateOne(
        {
          _id: oldThread._id,
        },
        {
          $set: {
            message: reply._id,
            updated: reply.created,
            read: true,
            userFrom: userRegular2Id,
            userTo: userAdmin._id,
          },
        },
      );
      await send();
      const finalThread = await Thread.findById(oldThread._id);
      if (!finalThread) throw new Error('Expected final thread');
      String(finalThread.message).should.equal(reply._id.toString());
      String(finalThread.userFrom).should.equal(String(userRegular2Id));
      should(finalThread.read).equal(true);
      (await Thread.countDocuments({})).should.equal(1);
      (
        await Message.countDocuments({
          userFrom: userAdmin._id,
        })
      ).should.equal(1);
    });
    it('reports zero deliveries when the member contacted nobody', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      const { body } = await agent
        .post('/api/admin/messages/scammer-warning')
        .send({
          username: userAdmin.username,
          content: 'Safety warning',
          requestId: '11111111111141118111111111111111',
        })
        .expect(200);
      body.sent.should.equal(0);
    });
    it('validates the username and warning content', async () => {
      await utils.signInPrivileged(credentialsAdmin, agent);
      let response = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({})
        .expect(400);
      response.body.message.should.equal('Missing `username` field.');
      response = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({
          username: 'missing-member',
        })
        .expect(404);
      response.body.message.should.equal('Member does not exist.');
      response = await agent
        .post('/api/admin/messages/scammer-warning')
        .send({
          username: userRegular1.username,
          requestId: '11111111111141118111111111111111',
          content: '<script>x</script>',
        })
        .expect(400);
      response.body.message.should.equal('Please write a message.');
      response = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({
          username: '   ',
        })
        .expect(400);
      response.body.message.should.equal('Missing `username` field.');
    });
  });
});
