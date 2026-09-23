const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const controller = require('../../server/controllers/admin.location-corrections.server.controller');
require('should');

const Offer = mongoose.model('Offer');
const Message = mongoose.model('Message');
const MessageStat = mongoose.model('MessageStat');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');
const app = express.init(mongoose.connection);

const exact = [48.6908333333, 9.14055555556];
const nearby = [48.691, 9.141];

describe('Welcome team location corrections', () => {
  let team;
  let secondTeam;
  let member;
  let teamAgent;
  let secondAgent;

  beforeEach(async () => {
    const users = utils.generateUsers(5);
    users.forEach(user => {
      user.public = true;
      user.description =
        'I help members find each other and keep their offers accurate. I enjoy welcoming travellers, sharing local knowledge, and building thoughtful conversations across the community.';
    });
    users[0].roles = ['user', 'welcome-team'];
    users[1].roles = ['user', 'welcome-team'];
    [team, secondTeam, member] = await utils.saveUsers(users);
    teamAgent = request.agent(app);
    secondAgent = request.agent(app);
    await utils.signIn(
      { username: team.username, password: users[0].password },
      teamAgent,
    );
    await utils.signIn(
      { username: secondTeam.username, password: users[1].password },
      secondAgent,
    );
  });

  afterEach(utils.clearDatabase);

  it('classifies only coordinates inside the historic area', () => {
    const {
      classifyLocation,
      candidateKey,
      compareCandidates,
      isEligibleRecipient,
    } = controller._test;
    compareCandidates(
      { match: 'exact', username: 'a' },
      { match: 'nearby', username: 'b' },
    ).should.equal(-1);
    compareCandidates(
      { match: 'nearby', username: 'b' },
      { match: 'exact', username: 'a' },
    ).should.equal(1);
    classifyLocation(exact).should.equal('exact');
    classifyLocation(nearby).should.equal('nearby');
    for (const location of [
      null,
      [48],
      [48.68, 9.14],
      [48.7, 9.14],
      [48.69, 9.12],
      [48.69, 9.16],
    ]) {
      require('should')(classifyLocation(location)).be.null();
    }
    const first = [
      { _id: 'a', location: exact },
      { _id: 'b', location: nearby },
    ];
    candidateKey(member._id, first).should.equal(
      candidateKey(member._id, first.slice().reverse()),
    );
    require('should')(isEligibleRecipient(null, team._id)).not.be.true();
    isEligibleRecipient(
      { ...member.toObject(), public: false },
      team._id,
    ).should.not.be.true();
    isEligibleRecipient(member, member._id).should.not.be.true();
    isEligibleRecipient(
      { ...member.toObject(), roles: ['shadowban'] },
      team._id,
    ).should.not.be.true();
    isEligibleRecipient(
      { ...member.toObject(), removeProfileToken: 'pending' },
      team._id,
    ).should.not.be.true();
    isEligibleRecipient(
      {
        ...member.toObject(),
        removeProfileToken: 'pending',
        removeProfileExpires: 'invalid',
      },
      team._id,
    ).should.not.be.true();
    isEligibleRecipient(
      {
        ...member.toObject(),
        removeProfileToken: 'pending',
        removeProfileExpires: new Date(Date.now() + 86400000),
      },
      team._id,
    ).should.not.be.true();
    isEligibleRecipient(
      {
        ...member.toObject(),
        removeProfileToken: 'expired',
        removeProfileExpires: new Date(Date.now() - 86400000),
      },
      team._id,
    ).should.be.true();
  });

  async function addOffer(user, location, overrides = {}) {
    return new Offer({
      user: user._id,
      type: 'host',
      status: 'yes',
      description: 'A place to stay.',
      location,
      ...overrides,
    }).save();
  }

  it('lists exact and nearby active offers once per member and excludes ineligible members', async () => {
    await addOffer(member, exact);
    await addOffer(member, nearby, {
      type: 'meet',
      validUntil: new Date(Date.now() + 86400000),
    });
    await addOffer(member, exact, {
      type: 'meet',
      validUntil: new Date(Date.now() - 86400000),
    });
    const privateMember = await User.findOne({
      _id: { $nin: [team._id, secondTeam._id, member._id] },
    });
    privateMember.public = false;
    await privateMember.save();
    await addOffer(privateMember, exact);
    await addOffer(team, exact);
    await addOffer(member, [52, 13], { status: 'no' });

    const { body } = await teamAgent
      .get('/api/admin/location-corrections')
      .expect(200);
    body.should.have.length(1);
    body[0].userId.should.equal(String(member._id));
    body[0].match.should.equal('exact');
    body[0].offers.should.have.length(2);
    body[0].offers.some(offer => offer.match === 'nearby').should.be.true();
  });

  it('orders exact members before nearby members and sorts each group by username', async () => {
    const others = await User.find({
      _id: { $nin: [team._id, secondTeam._id, member._id] },
    });
    await User.updateOne({ _id: member._id }, { username: 'z_exact' });
    await User.updateOne({ _id: others[0]._id }, { username: 'a_exact' });
    await User.updateOne({ _id: others[1]._id }, { username: 'a_nearby' });
    await addOffer(others[1], nearby);
    await addOffer(member, exact);
    await addOffer(others[0], exact);
    const { body } = await teamAgent
      .get('/api/admin/location-corrections')
      .expect(200);
    body
      .map(candidate => candidate.username)
      .should.deepEqual(['a_exact', 'z_exact', 'a_nearby']);
  });

  it('sends once from the team member and hides unchanged locations', async () => {
    const offer = await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    const payload = {
      userId: candidate.userId,
      key: candidate.key,
      content: 'Please check your offer location.',
    };
    const { body: sent } = await teamAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(200);
    sent.sent.should.be.true();
    const message = await Message.findById(sent.messageId);
    String(message.userFrom).should.equal(String(team._id));
    String(message.userTo).should.equal(String(member._id));
    message.locationCorrectionOffers.should.have.length(1);
    Array.from(message.locationCorrectionOffers[0].location).should.deepEqual(
      exact,
    );
    (await Thread.countDocuments({ message: message._id })).should.equal(1);
    (
      await MessageStat.countDocuments({
        firstMessageUserFrom: team._id,
        firstMessageUserTo: member._id,
      })
    ).should.equal(1);
    (
      await teamAgent.get('/api/admin/location-corrections').expect(200)
    ).body.should.have.length(0);

    const retry = await secondAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(200);
    retry.body.sent.should.be.false();
    (
      await Message.countDocuments({ locationCorrectionKey: candidate.key })
    ).should.equal(1);
    (
      await MessageStat.countDocuments({
        firstMessageUserFrom: team._id,
        firstMessageUserTo: member._id,
      })
    ).should.equal(1);

    offer.location = nearby;
    await offer.save();
    const changed = await secondAgent
      .get('/api/admin/location-corrections')
      .expect(200);
    changed.body.should.have.length(1);
    changed.body[0].match.should.equal('nearby');
    changed.body[0].key.should.not.equal(candidate.key);
    await secondAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(409);
  });

  it('repairs the thread on a retry after message storage succeeded', async () => {
    await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    const payload = {
      userId: candidate.userId,
      key: candidate.key,
      content: 'Please check your location.',
    };
    const stub = sinon
      .stub(Thread, 'updateOne')
      .throws(new Error('thread unavailable'));
    try {
      await teamAgent
        .post('/api/admin/location-corrections/send')
        .send(payload)
        .expect(500);
    } finally {
      stub.restore();
    }
    (
      await Message.countDocuments({ locationCorrectionKey: candidate.key })
    ).should.equal(1);
    const retry = await teamAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(200);
    retry.body.sent.should.be.false();
    const message = await Message.findOne({
      locationCorrectionKey: candidate.key,
    });
    (await Thread.countDocuments({ message: message._id })).should.equal(1);
  });

  it('recovers from concurrent message and thread inserts', async () => {
    await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    const payload = {
      userId: candidate.userId,
      key: candidate.key,
      content: 'Please check your location.',
    };
    const originalMessageUpdate = Message.findOneAndUpdate;
    const messageStub = sinon
      .stub(Message, 'findOneAndUpdate')
      .callsFake((...args) => ({
        exec: async () => {
          messageStub.restore();
          await originalMessageUpdate.apply(Message, args).exec();
          const error = new Error('concurrent message insert');
          error.code = 11000;
          throw error;
        },
      }));
    const originalThreadUpdate = Thread.updateOne;
    let firstThreadUpdate = true;
    const threadStub = sinon.stub(Thread, 'updateOne').callsFake((...args) => {
      if (firstThreadUpdate) {
        firstThreadUpdate = false;
        return {
          exec: async () => {
            const error = new Error('concurrent thread insert');
            error.code = 11000;
            throw error;
          },
        };
      }
      return originalThreadUpdate.apply(Thread, args);
    });
    try {
      const { body } = await teamAgent
        .post('/api/admin/location-corrections/send')
        .send(payload)
        .expect(200);
      body.sent.should.be.false();
      (await Thread.countDocuments({ message: body.messageId })).should.equal(
        1,
      );
    } finally {
      if (messageStub.restore) messageStub.restore();
      threadStub.restore();
    }
  });

  it('reports unexpected message storage failures', async () => {
    await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    const stub = sinon
      .stub(Message, 'findOneAndUpdate')
      .throws(new Error('message storage unavailable'));
    try {
      await teamAgent
        .post('/api/admin/location-corrections/send')
        .send({
          userId: candidate.userId,
          key: candidate.key,
          content: 'Please check your location.',
        })
        .expect(500);
    } finally {
      stub.restore();
    }
  });

  it('handles candidate loading failures without sending', async () => {
    const stub = sinon
      .stub(Offer, 'find')
      .throws(new Error('database unavailable'));
    try {
      await teamAgent.get('/api/admin/location-corrections').expect(500);
      await teamAgent
        .post('/api/admin/location-corrections/send')
        .send({
          userId: String(member._id),
          key: 'a'.repeat(64),
          content: 'Please check.',
        })
        .expect(500);
    } finally {
      stub.restore();
    }
  });

  it('rejects stale, invalid, or empty send requests', async () => {
    const offer = await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send({ userId: 'bad', key: candidate.key, content: 'Hello' })
      .expect(400);
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send({ userId: candidate.userId, key: candidate.key, content: ' ' })
      .expect(400);
    offer.location = [52, 13];
    await offer.save();
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send({
        userId: candidate.userId,
        key: candidate.key,
        content: 'Please check.',
      })
      .expect(409);
    (
      await Message.countDocuments({ locationCorrectionKey: candidate.key })
    ).should.equal(0);
  });

  it('checks the sender account again when sending', async () => {
    await addOffer(member, exact);
    const {
      body: [candidate],
    } = await teamAgent.get('/api/admin/location-corrections').expect(200);
    const payload = {
      userId: candidate.userId,
      key: candidate.key,
      content: 'Please check your location.',
    };
    await User.updateOne({ _id: team._id }, { public: false });
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(403);
    await User.updateOne(
      { _id: team._id },
      { public: true, roles: ['user', 'welcome-team', 'shadowban'] },
    );
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(403);
    await User.updateOne(
      { _id: team._id },
      { roles: ['user', 'welcome-team'], description: '' },
    );
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send(payload)
      .expect(400);
    (await Message.countDocuments()).should.equal(0);
  });

  it('validates a missing request body', async () => {
    const result = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send() {
        return this;
      },
    };
    await controller.send({ body: null }, result);
    result.statusCode.should.equal(400);
  });

  it('limits the queue and send endpoint to the welcome team', async () => {
    await addOffer(member, exact);
    const guest = request.agent(app);
    await guest.get('/api/admin/location-corrections').expect(403);
    await guest
      .post('/api/admin/location-corrections/send')
      .send({})
      .expect(403);
    await User.updateOne(
      { _id: team._id },
      { $pull: { roles: 'welcome-team' } },
    );
    await teamAgent.get('/api/admin/location-corrections').expect(403);
    await teamAgent
      .post('/api/admin/location-corrections/send')
      .send({})
      .expect(403);
  });
});
