const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const should = require('should');

/**
 * Globals
 */
let app;
let agent;
let credentialsAdmin;
let credentialsRegular;
let userAdmin;
let userRegular1;
let userRegular2;
let userRegular1Id;
let userRegular2Id;

describe('Admin Message CRUD tests', () => {
  before(done => {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(async () => {
    try {
      // Create admin credentials
      credentialsAdmin = {
        username: 'user-admin',
        password: 'Password123!',
      };

      // Create regular user credentials
      credentialsRegular = {
        username: 'user-regular1',
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
        username: 'user-regular2',
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
        .send({ user1: userRegular1Id, user2: userRegular2Id })
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
            .send({ user1: userRegular1Id, user2: userRegular2Id })
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to read messages', done => {
      agent
        .post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end(signinErr => {
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/admin/messages')
            .send({ user1: userRegular1Id, user2: userRegular2Id })
            .expect(200)
            .end((err, res) => {
              res.body.messages.length.should.equal(2);
              res.body.messages[0].userFrom.username.should.equal(
                'user-regular1',
              );
              res.body.messages[0].userTo.username.should.equal(
                'user-regular2',
              );
              res.body.referenceThreads.length.should.equal(1);
              res.body.referenceThreads[0].reference.should.equal('yes');
              res.body.referenceThreads[0].userFrom.username.should.equal(
                'user-regular1',
              );
              res.body.referenceThreads[0].userTo.username.should.equal(
                'user-regular2',
              );
              return done(err);
            });
        });
    });
  });

  describe('Warn scammer recipients', () => {
    it('lists distinct existing recipients contacted by a username', async () => {
      await utils.signIn(credentialsAdmin, agent);
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
        .send({ username: userRegular1.username })
        .expect(200);

      body.scammer.username.should.equal(userRegular1.username);
      body.recipients.length.should.equal(1);
      body.recipients[0].username.should.equal(userRegular2.username);
    });

    it('sends a sanitised warning and updates the recipient thread', async () => {
      await utils.signIn(credentialsAdmin, agent);

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
      warning.content.should.equal('<p>Ignore this scam.</p>');
      const thread = await Thread.findOne({ message: warning._id }).exec();
      thread.userFrom.toString().should.equal(userAdmin._id.toString());
      thread.userTo.toString().should.equal(userRegular2Id.toString());
      thread.read.should.equal(false);
    });

    it('repairs a partial delivery without duplicating messages or resetting read state', async () => {
      await utils.signIn(credentialsAdmin, agent);
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
      const filter = { userFrom: userAdmin._id, userTo: userRegular2Id };
      (await Message.countDocuments(filter)).should.equal(1);
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send(payload)
        .expect(200);
      const message = await Message.findOne(filter);
      (await Message.countDocuments(filter)).should.equal(1);
      const thread = await Thread.findOne({ message: message._id });
      should.exist(thread);
      await Message.updateOne({ _id: message._id }, { $set: { read: true } });
      await Thread.updateOne({ _id: thread._id }, { $set: { read: true } });
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send(payload)
        .expect(200);
      (await Message.findById(message._id)).read.should.equal(true);
      (await Thread.findById(thread._id)).read.should.equal(true);
      (await Message.countDocuments(filter)).should.equal(1);
      await agent
        .post('/api/admin/messages/scammer-warning')
        .send({ ...payload, requestId: '33333333333343338333333333333333' })
        .expect(200);
      (await Message.countDocuments(filter)).should.equal(2);
    });

    it('requires a valid request ID before saving warning messages', async () => {
      await utils.signIn(credentialsAdmin, agent);
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
      (await Message.countDocuments({ userFrom: userAdmin._id })).should.equal(
        0,
      );
    });

    it('reports zero deliveries when the member contacted nobody', async () => {
      await utils.signIn(credentialsAdmin, agent);

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
      await utils.signIn(credentialsAdmin, agent);

      let response = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({})
        .expect(400);
      response.body.message.should.equal('Missing `username` field.');

      response = await agent
        .post('/api/admin/messages/scammer-recipients')
        .send({ username: 'missing-member' })
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
        .send({ username: '   ' })
        .expect(400);
      response.body.message.should.equal('Missing `username` field.');
    });
  });
});
